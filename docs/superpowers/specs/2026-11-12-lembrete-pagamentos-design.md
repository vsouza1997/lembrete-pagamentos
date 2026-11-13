# Lembrete de Pagamentos (WhatsApp) — Design

Data: 2026-11-12

## Objetivo

Ferramenta para a esposa do Victor lembrar as alunas, pelo WhatsApp, dos dias de pagamento da mensalidade.

## Escopo

### v1 (semi-automático)
- Site instalável no celular (PWA), hospedado no Firebase Hosting.
- Login com Google, restrito a um único usuário (a esposa).
- Dados no Firestore.
- Tela **Hoje** com duas listas: **Vencem hoje** e **Atrasadas**.
- Uma terceira lista, **Pagas neste mês**, mostra quem já pagou e permite **Desfazer**.
- Cada aluna na lista mostra nome, valor (se houver) e dois botões:
  - **Lembrar**: abre `https://wa.me/<telefone>?text=<mensagem>` com a mensagem pronta; ela só toca em enviar.
  - **Paga**: registra o pagamento do mês corrente; a aluna sai da lista.
- Aba **Alunas**: cadastrar, editar, desativar.
- Modelo de mensagem editável com variáveis `{nome}`, `{valor}`, `{dia}`.

### Decisão: o projeto fica no semi-automático (wa.me). O automático abaixo é só um plus futuro, sem prazo e sem opção escolhida.

### Fora da v1 (plus futuro): envio automático
- Envio sem toque, em horário agendado.
- A v1 isola o envio atrás de uma interface `Sender` (`enviar(aluna, mensagem)`). A v1 implementa `WaMeSender` (abre o link). Um futuro `ApiSender` (WhatsApp Business API oficial, via Cloud Functions agendadas) troca só essa peça.
- Requisitos do automático, a decidir depois: plano Blaze do Firebase, provedor da API, modelos de mensagem aprovados, custo por mensagem. Opção não oficial (biblioteca) tem risco de banimento do número e não é recomendada.

## Dados (Firestore)

- `alunas/{id}`: `nome`, `telefone` (formato 55DDDNÚMERO, só dígitos), `diaVencimento` (1–31), `valor` (opcional), `ativa` (bool).
- `pagamentos/{alunaId}_{AAAA-MM}`: `alunaId`, `mes` ("AAAA-MM"), `pagoEm` (timestamp). O id determinístico garante um registro por aluna por mês.
- `config/mensagem`: texto do modelo de mensagem.

## Regras de negócio

- Vencimento efetivo no mês = `min(diaVencimento, último dia do mês)`.
- **Vence hoje**: aluna ativa, vencimento efetivo == hoje, sem pagamento no mês corrente.
- **Atrasada**: aluna ativa, vencimento efetivo < hoje, sem pagamento no mês corrente.
- Atrasos de meses anteriores não entram na v1.
- Data "hoje" no fuso America/Sao_Paulo.
- Marcar como paga cria o pagamento do mês; desfazer remove o registro.

## Arquitetura

- Front-end estático (HTML/JS sem framework pesado), Firebase Auth + Firestore SDK.
- `core/vencimentos.js`: funções puras (vencimento efetivo, vence hoje, atrasada). Sem dependência de Firebase.
- `core/mensagem.js`: render do modelo com variáveis e montagem do link wa.me.
- `core/sender.js`: interface `Sender` + `WaMeSender`.
- `data/`: acesso ao Firestore (alunas, pagamentos, config).
- `ui/`: telas Hoje e Alunas.

## Segurança

- Regras do Firestore permitem leitura/escrita somente ao `uid` da esposa.
- Telefones das alunas ficam apenas no Firestore, nunca no código.

## Erros

- Telefone inválido: validação no cadastro (DDI 55 + DDD + número); botão Lembrar desabilitado se inválido.
- Sem internet: mensagem clara; Firestore mantém cache offline para leitura.

## Testes

- Testes unitários das funções puras: dia 29/30/31 em fevereiro e meses de 30 dias, ano bissexto, virada de mês, aluna paga vs não paga, aluna inativa.
- Teste do render de mensagem e do link wa.me (codificação de acentos e emoji).
