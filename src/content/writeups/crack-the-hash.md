---
title: "Crack the Hash"
date: 2026-05-10
summary: "Identificação e quebra de hashes com HashID, Hashcat, John the Ripper e CrackStation."
platform: "TryHackMe"
difficulty: "Média"
os: "Outro"
tags: ["Hashcat", "John the Ripper", "Criptografia", "Wordlists"]
draft: false
---

## Visão Geral

Este documento detalha o processo de identificação e quebra de *hashes* criptográficos abordados em múltiplos desafios da plataforma TryHackMe (níveis 1, 2 e salas adicionais como OFFSECFCIL e SAWCTF). O foco principal consistiu na utilização de ferramentas como HashID e Hash Analyzer para o reconhecimento de assinaturas, aliados ao uso extensivo do Hashcat e técnicas de filtro de *wordlists* para condução de ataques de força bruta. Em casos de exaustão de dicionários locais, recorreu-se a serviços de *rainbow tables* online como o CrackStation.

## Level 1

### Hash 1: `48bb6e862e54f2a795ffc4e541caed4d`

Primeiramente, adicionamos o *hash* a um arquivo de texto (`.txt`) para facilitar os testes e as tentativas de quebra via terminal.

```bash
echo "48bb6e862e54f2a795ffc4e541caed4d" > hash1.txt
```

A primeira possibilidade levantada foi de que se tratava de um MD2, porém a tentativa utilizando a ferramenta **John the Ripper** não obteve sucesso.

![Tentativa de quebra frustrada assumindo formato MD2.](/images/writeups/crack-the-hash/hash1-hashid.png)

Em seguida, ajustamos a estratégia para testar a assinatura como MD5 utilizando o **Hashcat**, o que resultou na descoberta bem-sucedida da senha.

![Sucesso na quebra do MD5 com o Hashcat.](/images/writeups/crack-the-hash/hash1-hashcat-cracked.png)

### Hash 2: `CBFDAC6008F9CAB4083784CBD1874F76618D2A97`

Utilizando o **HashID**, identificamos que a assinatura correspondia a um SHA-1. A quebra foi realizada através do Hashcat no modo 100 (`-m 100`), aplicando um ataque de força bruta atrelado à *wordlist* RockYou.

![Identificação do tipo de hash como SHA-1.](/images/writeups/crack-the-hash/hash2-hashid.png)

![Quebra do SHA-1 utilizando o modo 100 do Hashcat.](/images/writeups/crack-the-hash/hash2-hashcat.png)

### Hash 3: `1C8BFE8F801D79745C4631D09FFF36C82AA37FC4CCE4FC946683D7B336B63032`

Inicialmente, submetemos a *string* ao HashID, que apontou o algoritmo **Snefru-256** como a primeira opção. No entanto, o teste da string na ferramenta online CyberChef não retornou nenhum resultado válido.

![Resultado do HashID indicando Snefru-256 e SHA-256.](/images/writeups/crack-the-hash/hash3-hashid.png)

Partindo para a segunda alternativa indicada ("SHA-256"), o Hashcat foi configurado para operar no modo 1400. A injeção da *wordlist* RockYou foi suficiente para revelar o conteúdo oculto.

![Sucesso na quebra do SHA-256 (modo 1400).](/images/writeups/crack-the-hash/hash3-hashcat.png)

### Hash 4: `$2y$12$Dwt1BZj6pcyc3Dy1FWZ5ieeUznr71EeNkJkUlypTsgbX1H68wsRom`

O utilitário HashID não foi capaz de identificar este formato corretamente. Ao consultar a plataforma online **Hash Analyzer**, constatou-se que se tratava de uma assinatura **bcrypt**.

Devido ao alto custo computacional inerente ao bcrypt (algoritmo lento por design), a utilização da *wordlist* padrão do RockYou resultaria em um tempo inviável de processamento no Hashcat. Para otimizar o processo, utilizou-se o comando `grep` a fim de criar um dicionário reduzido contendo exclusivamente palavras de exatamente 4 letras.

```bash
grep -x '[a-z]\{4\}' /usr/share/wordlists/rockyou.txt > rockyou_4.txt
```

![Utilização do `grep` para filtrar a *wordlist*.](/images/writeups/crack-the-hash/hash4-reduzirp4letras.png)

Com a lista altamente restrita, a execução do Hashcat no modo 3200 finalizou rapidamente, retornando a senha correta.

![Quebra rápida do bcrypt com dicionário filtrado.](/images/writeups/crack-the-hash/hash4-hashcat.png)

### Hash 5: `279412f945939ba78ce0758d3fd83daa`

A ferramenta HashID classificou-o primariamente como MD5. Todavia, a tentativa de quebra local exauriu o dicionário do Hashcat sem encontrar *matches* (*exhausted*). Testes assumindo o formato MD4 também retornaram o mesmo erro de exaustão.

Considerando que o problema residia nas limitações do dicionário local, o *hash* foi submetido ao serviço **CrackStation**, o qual retornou o texto em claro com êxito graças à sua vasta *rainbow table* em nuvem.

![Identificação inconclusiva/exaustão de *wordlist* local.](/images/writeups/crack-the-hash/hash5-hashid.png)

![Sucesso na recuperação da senha via CrackStation.](/images/writeups/crack-the-hash/hash5-crackstation.png)

## Level 2

### Hash 1: `F09EDCB1FCEFC6DFB23DC3505A882655FF77375ED8AA2D1C13F640FCCC2D0C85`

As opções sugeridas pelo HashID apontavam tanto para Snefru-256 quanto para SHA-256. Como as instruções da fase exigiam priorizar o uso do Hashcat, o formato **SHA-256** foi escolhido como vetor de teste inicial, sendo quebrado instantaneamente.

![Sondagem dos formatos via HashID.](/images/writeups/crack-the-hash/L2-hash1-hashid.png)

![Confirmação da senha usando o Hashcat em SHA-256.](/images/writeups/crack-the-hash/L2-hash1-hashcat.png)

### Hash 2: `1DFECA0C002AE40B8619ECF94819CC1B`

As tentativas sistemáticas no Hashcat utilizando os modos referentes a MD2, MD4 e MD5 esgotaram completamente a base de senhas (*exhausted*). Ao desviar a abordagem e submetê-lo ao banco de dados do CrackStation, a senha foi revelada e a assinatura foi confirmada como sendo do tipo **NTLM**.

![Sondagem dos formatos via HashID.](/images/writeups/crack-the-hash/L2-hash2-hashid.png)

![Sucesso na recuperação da senha via CrackStation.](/images/writeups/crack-the-hash/L2-hash2-crackstation.png)

### Hash 3: `$6$aReallyHardSalt$6WKUTqz...`

A inspeção inicial com o HashID reconheceu a formatação clássica do **SHA-512 Crypt** (identificada pelo prefixo `$6$`). Com isso, o Hashcat foi configurado para o modo 1800, utilizando força bruta com o dicionário RockYou para processar o alvo e extrair a *flag*.

![Identificação exata do SHA-512 Crypt pelo prefixo.](/images/writeups/crack-the-hash/L2-hash3-hashid.png)

![Operação bem-sucedida do Hashcat no modo 1800.](/images/writeups/crack-the-hash/L2-hash3-hashcat.png)

### Hash 4: `e5d8870e5bdd26602cab8dbe07a942c8669e56d6:tryhackme`

A estrutura `<hash>:<salt>` e as dicas intrínsecas da plataforma confirmaram a natureza de um **HMAC-SHA1**. Passando essa matriz diretamente para o Hashcat rodando no modo específico 160, a correspondência foi encontrada.

## Salas OFFSECFCIL e SAWCTF

### Hash 1: `482c811da5d5b4bc6d497ffa98491e38`

Dada a rapidez do serviço externo, optou-se pela verificação direta no CrackStation, que identificou e revelou a senha em claro.

![Sondagem dos formatos via HashID.](/images/writeups/crack-the-hash/saw-hash1-hashid.png)

![Sucesso na recuperação da senha via CrackStation.](/images/writeups/crack-the-hash/saw-hash1-crackstation.png)

### Hash 2: `861c4f67e887dec85292d36ab05cd7a1a7275228`

Similar ao desafio anterior, o *hash* foi alimentado no portal CrackStation e quebrado com sucesso imediatamente.

![Sondagem dos formatos via HashID.](/images/writeups/crack-the-hash/saw-hash2-hashid.png)

![Sucesso na recuperação da senha via CrackStation.](/images/writeups/crack-the-hash/saw-hash2-crackstation.png)

### Hash 3: `4149c5cc4c378444d116d65ad5ba4099`

Após falhas iniciais assumindo o comportamento de um formato MD5, a alteração dos parâmetros do Hashcat para focar na matriz **MD4** (modo 900) e a execução de força bruta normalizada entregaram a *string* verdadeira.

![Classificação inicial falha e desvio para MD4.](/images/writeups/crack-the-hash/saw-hash3-hashid.png)

![Quebra efetiva do formato MD4 (modo 900).](/images/writeups/crack-the-hash/saw-hash3-hashcat.png)

### Hash 4: `cdeb746ec095149627348b61d4140fc58b745875`

O enunciado entregava diretamente a variável de ***Salt**: `satech`* combinada com as dicas do tipo de criptografia. Bastou formatar a entrada adequadamente para o Hashcat processar e resolver o desafio.

![Uso de salt pré-definido acoplado ao hash original.](/images/writeups/crack-the-hash/saw-hash4-hashcat.png)

### Hash 5: `362fda2183b7ac73400a83f6ab2c359451e48adf6c3d46a2963ee2abdf852912`

Para finalizar, o cenário restringia o espaço de busca (*keyspace*) informando que a senha possuía apenas letras minúsculas, números e um comprimento máximo de 6 caracteres. Essa configuração ideal permitiu definir uma máscara de ataque bruta super rápida no Hashcat.

![Força bruta pura aplicando regras customizadas de caracteres.](/images/writeups/crack-the-hash/saw-hash5-hashcat.png)

## Conclusão

Os exercícios demonstraram a importância crítica não só da identificação prévia e correta dos algoritmos de *hashing*, mas da maleabilidade analítica durante o processo de quebra de senhas. Observou-se na prática que dicionários não são balas de prata: algoritmos com custo computacional alto (como bcrypt) exigem *wordlists* refinadas cirurgicamente por utilitários como o `grep`, enquanto restrições de formatação impulsionam a necessidade de ataques de máscara no Hashcat.

Ademais, quando o esforço computacional local atinge um limiar (*exhausted*), serviços como o CrackStation proveem suporte indispensável validando ou quebrando *hashes* legados do tipo NTLM e MD4 de forma extremamente eficiente.
