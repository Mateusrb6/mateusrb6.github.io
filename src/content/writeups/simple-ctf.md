---
title: "Simple CTF"
date: 2026-05-03
summary: "FTP anônimo, SQL injection no CMS Made Simple, acesso por SSH e escalada com vim."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["FTP", "SQL Injection", "CMS", "Sudo"]
draft: false
---

## Visão Geral

A máquina Simple CTF apresenta um cenário prático de enumeração de serviços básicos, exploração de vulnerabilidades web conhecidas e abuso de privilégios locais para comprometer totalmente o sistema.

O vetor de ataque inicial envolve a coleta de informações através de um servidor FTP com acesso anônimo habilitado. Em seguida, a enumeração de diretórios revela uma instalação vulnerável de um CMS (*Content Management System*). A exploração de uma falha de *SQL Injection* (CVE-2019-9053) neste CMS permite a extração e quebra de credenciais de usuário. Após estabelecer o acesso inicial via SSH, a escalada de privilégios explora uma má configuração clássica do `sudo`, onde o usuário possui permissão para executar o editor `vim` como superusuário, possibilitando a criação de um shell com privilégios máximos (root).

## Reconhecimento

Inicialmente, executou-se uma varredura utilizando o **Nmap** para mapear a superfície de ataque e descobrir quais portas e serviços estavam expostos na máquina alvo. O resultado indicou 3 portas abertas: FTP (21), HTTP (80) e um serviço SSH rodando em uma porta não padrão (2222).

```bash
nmap -sC -sV -v -p- <TARGET_IP>
# Output resumido:
# PORT     STATE SERVICE VERSION
# 21/tcp   open  ftp     vsftpd 3.0.3
# 80/tcp   open  http    Apache httpd 2.4.18 ((Ubuntu))
# 2222/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.8
```

![Resultado do Nmap evidenciando as portas 21, 80 e 2222 abertas.](/images/writeups/simple-ctf/nmap.png)

Os *scripts* padrão do Nmap indicaram que o serviço FTP possuía uma falha grave de configuração: permitia *login* anônimo (usuário `anonymous` sem senha). Conectando ao serviço, foi possível listar e baixar um arquivo de texto.

```bash
ftp <TARGET_IP>
# Name: anonymous
# Password: [em branco]
ls
get ForMitch.txt
cat ForMitch.txt
```

O arquivo continha uma mensagem direcionada a um usuário chamado **Mitch**, alertando sobre a fraqueza de segurança do sistema e o uso de credenciais fracas. Essa informação foi valiosa, confirmando um potencial nome de usuário válido para o sistema.

![Acesso anônimo ao FTP e leitura da mensagem para Mitch.](/images/writeups/simple-ctf/ftp.png)

Sabendo da existência de uma aplicação web rodando na porta 80, o IP da máquina alvo foi adicionado ao arquivo `/etc/hosts` e associado ao domínio `simple.thm` para facilitar o processo de exploração. Em seguida, o **Feroxbuster** foi empregado para realizar a força bruta de diretórios apontando para o domínio recém-configurado.

```bash
feroxbuster -u http://simple.thm -w /usr/share/wordlists/dirb/common.txt
```

![Resultado do Feroxbuster mostrando os diretórios descobertos no servidor web.](/images/writeups/simple-ctf/feroxbuster.png)

A listagem revelou um diretório `/simple`, que continha a página inicial de um CMS (CMS Made Simple) e um portal de login para a administração da plataforma, servindo como nossa principal superfície de ataque web.

## Exploração

Inspecionando o rodapé e o código-fonte da página inicial do CMS em `/simple`, foi possível descobrir a versão específica em uso. Utilizando a ferramenta **Searchsploit**, realizou-se uma busca por vulnerabilidades conhecidas para aquela versão exata.

A pesquisa revelou que o sistema era vulnerável a *SQL Injection* baseada em tempo (Time-Based Blind SQLi) através do rastreamento da CVE-2019-9053.

![Painel de login administrativo do CMS Made Simple.](/images/writeups/simple-ctf/painel-login.png)

![Informações da CVE-2019-9053 e o exploit Python encontrado.](/images/writeups/simple-ctf/CVE.png)

Um *script* público desenvolvido em Python foi obtido em um repositório do GitHub (<https://github.com/CaelumIsMe/CVE-2019-9053-POC/blob/main/cms_exploit.py>). O exploit foi executado contra o alvo fornecendo uma *wordlist* para quebra da senha:

```bash
python3 cms_exploit.py -u http://simple.thm/simple -w /usr/share/wordlists/rockyou.txt
```

O script automatizou a injeção SQL no parâmetro de *news*, extraiu o *salt*, o *hash* da senha, o e-mail e o nome de usuário (`mitch`). Além de extrair os dados, o exploit realizou o *cracking* do *hash* em tempo real, revelando a senha em texto claro.

Com a senha em mãos e sabendo que o serviço SSH estava exposto na porta 2222, o acesso foi facilmente estabelecido:

```bash
ssh mitch@<TARGET_IP> -p 2222
# [senha omitida para evitar spoilers]
```

![Acesso bem-sucedido via SSH como o usuário Mitch.](/images/writeups/simple-ctf/ssh-mitch.png)

Após o *login*, a navegação básica revelou o arquivo com a primeira flag na raiz do diretório home do usuário.

```bash
cat /home/mitch/user.txt
# <USER_FLAG>
```

![Leitura da flag do usuário.](/images/writeups/simple-ctf/user-txt.png)

## Escalada de Privilégios

Para prosseguir com a escalada e obter controle total do servidor, o primeiro passo foi checar os privilégios atribuídos ao usuário atual através do arquivo `sudoers`.

```bash
sudo -l
# User mitch may run the following commands on Machine:
#    (root) NOPASSWD: /usr/bin/vim
```

O comando indicou que o usuário `mitch` tinha permissão explícita para rodar o editor de texto `vim` com privilégios de `root` sem a necessidade de inserir senha.

O editor `vim` possui a funcionalidade de invocar o interpretador de comandos diretamente do seu console interno. Para explorar essa característica, o binário foi invocado através do `sudo` e, logo após sua abertura, foi inserido o comando de execução de uma *shell*:

```bash
sudo vim
# Dentro do ambiente do VIM, digite:
:!bash
```

Como o `vim` estava sendo executado sob o contexto do superusuário, o terminal chamado herdou esses privilégios.

```bash
whoami
# root
cd /root
cat root.txt
# [flag omitida para evitar spoilers]
```

![Execução do escape no `vim` e leitura da flag root.](/images/writeups/simple-ctf/root-txt.png)

## Conclusão

O comprometimento da máquina Simple CTF demonstra como a união de diferentes vulnerabilidades pode gerar uma corrente de ataque devastadora. O vazamento de informações do FTP indicou o alvo, o CMS desatualizado com brecha para *SQL Injection* permitiu a extração de credenciais, e, por fim, o reuso de senhas (*Password Reuse*) da web para o SSH abriu as portas do servidor.

A obtenção de acesso como root foi possível exclusivamente devido ao princípio do "Menor Privilégio" (*Least Privilege*) ter sido ignorado durante a configuração do sistema. O binário `vim` nunca deveria ser atribuído ao grupo de execuções administrativas sem senha em ambientes de produção, pois atua nativamente como uma rota de fuga (*GTFOBin*) para um terminal de alta permissão.

## Referências

- CaelumIsMe (GitHub). *CVE-2019-9053-POC*. Disponível em: <https://github.com/CaelumIsMe/CVE-2019-9053-POC>.
- GTFOBins. *Vim -- GTFOBins*. Disponível em: <https://gtfobins.github.io/gtfobins/vim/>.
