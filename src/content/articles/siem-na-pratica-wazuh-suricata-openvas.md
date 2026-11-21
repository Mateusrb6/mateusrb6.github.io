---
title: "SIEM na prática: primeiras lições com Wazuh, Suricata e OpenVAS em laboratório"
date: 2026-11-21
summary: "Notas de um laboratório pessoal integrando Wazuh, Suricata e OpenVAS: o que muda entre 'instalar um SIEM' e operar um de verdade."
tags: ["Wazuh", "SIEM", "Suricata", "OpenVAS", "Blue Team", "Monitoramento"]
draft: false
---

## Contexto

Estudar segurança ofensiva em CTFs me ensina a pensar como atacante. Detecção é outro jogo: o que importa ali é volume, ruído e contexto, não técnica de exploração. Pra sair da teoria montei um laboratório isolado em casa com Wazuh como SIEM, Suricata como IDS de rede e OpenVAS rodando scans de vulnerabilidade por cima de tudo.

Isso aqui não é tutorial de instalação. É o que me surpreendeu depois que as três ferramentas já estavam de pé e eu precisei fazer elas conversarem entre si.

## Arquitetura do laboratório

Tudo isolado, sem internet liberada exceto pra atualizar assinaturas:

- Uma VM rodando Wazuh Manager, Indexer e Dashboard
- Duas ou três VMs Linux com o agente do Wazuh instalado, fazendo o papel de servidores
- Uma VM com Suricata em modo IDS, de olho no tráfego entre as outras
- Uma VM com OpenVAS/GVM disparando scans periódicos contra os mesmos alvos

O Suricata manda o `eve.json` pro Wazuh via agente. Os resultados do OpenVAS eu ainda correlaciono manualmente com o que o Wazuh já monitora, não cheguei a automatizar essa parte.

## O que aprendi

Instalar o agente e ver evento chegando no dashboard engana. Antes de qualquer regra avaliar aquilo, o log passa por um decoder, que extrai os campos de um texto cru. Sem decoder certo, o SIEM só guarda texto. Ele não entende nada.

O ruleset padrão também é barulhento. Alerta de nível 3 e 4 enche a tela rápido e esconde o que realmente importa. Foi aí que entendi o tamanho do trabalho: escrever regra própria, calibrar nível de severidade, usar `<if_sid>` pra encadear eventos. Três tentativas de login SSH falhas seguidas de um login bem-sucedido do mesmo IP é um padrão de força bruta que deu certo. Isoladas, são só três linhas de log.

O Suricata resolve um problema que o Wazuh sozinho não resolve: ele vê o que trafega entre as máquinas, não só o que acontece dentro de uma. Assinatura de rede suspeita batendo com evento de host na mesma janela de tempo pesa muito mais que qualquer um dos dois separado.

O OpenVAS cuspia uma lista de CVE por CVSS e por um tempo eu tratei aquilo como prioridade pronta. Não é. A mesma falha crítica numa VM de teste descartável e num ativo que concentra autenticação têm peso completamente diferente. Aprendi a cruzar severidade técnica com o quanto aquele ativo importa antes de decidir o que mexer primeiro.

E o ajuste de ruído nunca acaba. Analista que ignora alerta por cansaço vai ignorar o alerta real quando ele aparecer. Isso virou, pra mim, tão parte do trabalho quanto configurar a detecção em si.

## Próximos passos

Quero pegar as detecções que montei aqui e mapear contra o MITRE ATT&CK, pra ver quais táticas eu realmente cubro e, principalmente, onde estão os buracos.

## Referências

- Wazuh. Wazuh Documentation. https://documentation.wazuh.com/
- Open Information Security Foundation. Suricata User Guide. https://docs.suricata.io/
- Greenbone. Greenbone Vulnerability Management (OpenVAS) Documentation. https://docs.greenbone.net/
- MITRE. MITRE ATT&CK®. https://attack.mitre.org/
