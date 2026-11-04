# Audesp PC — Prestação de Contas do Terceiro Setor

Sistema web (100% estático) para **preencher, validar e gerar o arquivo JSON** de Prestação de Contas
do terceiro setor no padrão **Audesp / TCE-SP — Fase V, leiaute v1.16**.

Não precisa de servidor, banco de dados, login ou serviço pago. Os dados ficam no navegador do usuário.

---

## O que ele faz

- **Formulário gerado a partir dos JSON Schemas oficiais** — os 5 documentos de prestação de contas
  (Termo de Colaboração, Termo de Fomento, Termo de Parceria, Convênio e Contrato de Gestão) e a
  Declaração Negativa.
- **Validação real** contra o schema: campos obrigatórios, tipos, listas, tamanhos, padrões (CPF, CNPJ,
  certidões), datas, valores com 2 casas, limites mínimo/máximo e domínios oficiais.
- **Domínios legíveis** — os `enum` trazem os rótulos oficiais nos exemplos do schema
  (ex.: `1 — Diário Oficial do Município`), e o sistema os exibe no lugar de códigos soltos.
- **Conferência** — totais de entradas/saídas, saldos, contagens de itens e cruzamentos
  (pagamento sem documento fiscal, documento fiscal citando contrato inexistente, repasse sem empenho…).
- **Importação** — JSON do próprio sistema, JSON bruto do Audesp (tipo identificado pelo `descritor`)
  ou backup completo.
- **Backup e exportação** — um arquivo por prestação, com nome padronizado, e um backup geral.
- **Documentação no próprio site** — aba com os manuais oficiais do TCE-SP em PDF (v1.21 e Fase V 2024),
  visualizador embutido e a contagem de seções/campos obrigatórios de cada leiaute.
- **Funciona offline** depois da primeira visita (service worker).

---

## Como publicar no GitHub Pages (sem instalar nada)

1. Acesse <https://github.com> e faça login.
2. Clique em **New repository**. Nome sugerido: `audesp-pc`. Marque **Public** e clique em **Create repository**.
3. Na página do repositório vazio, clique em **uploading an existing file**.
4. Arraste **todo o conteúdo desta pasta** (o `index.html`, as pastas `css`, `js`, `dados` e os demais arquivos).
   - O GitHub aceita arrastar pastas — confirme que `dados/` e `js/` aparecem na lista.
   - O arquivo `.nojekyll` é importante: ele impede o GitHub de processar o site com Jekyll.
5. Clique em **Commit changes**.
6. Vá em **Settings → Pages**.
   - Em *Source*, escolha **Deploy from a branch**.
   - Em *Branch*, selecione **main** e a pasta **/ (root)**. Clique em **Save**.
7. Aguarde 1–2 minutos. O endereço aparece na própria tela: `https://SEU-USUARIO.github.io/audesp-pc/`.

Pronto. O site funciona em qualquer navegador moderno (Chrome, Edge, Firefox, Safari), no computador ou no celular.

> Dica: se quiser um domínio próprio depois, é só configurar em *Settings → Pages → Custom domain*.

### Alternativa: publicar com Git

Esta pasta **já é um repositório git** com um commit inicial (`main`). Basta apontar o remoto e enviar:

```bash
cd sistema-prestacao-contas
git remote add origin https://github.com/SEU-USUARIO/audesp-pc.git
git push -u origin main
```

Depois ative o Pages como no passo 6. Se preferir começar do zero, apague a pasta `.git`
e rode `git init -b main && git add . && git commit -m "Audesp PC"`.

---

## Como usar

1. **Nova prestação** → escolha o tipo, município, entidade, ano e mês (o fechamento é sempre **12**).
   O código do ajuste (15 a 19 dígitos) pode ficar para depois.
2. Preencha as seções. As listas (empregados, contratos, documentos fiscais, pagamentos, empenhos,
   repasses…) aceitam quantos itens precisar, com botões para **duplicar** e **remover** cada item.
3. Use **Validar** para ver todas as pendências e **Conferência** para checar números e cruzamentos.
4. **Baixar JSON** gera o arquivo pronto para envio, nomeado como
   `prestacao_contas_convenio_7107-10048-2024-12.json` (por exemplo).

O sistema salva automaticamente a cada alteração — repare no indicador “salvo às hh:mm” no topo.

> **Importante:** o armazenamento é local (IndexedDB do navegador). Use sempre o mesmo navegador e
> computador, e gere **Backup** com frequência. Limpar dados de navegação apaga os registros
> (os arquivos JSON já baixados permanecem).

---

## Estrutura da pasta

```
index.html                  página única do sistema
manifest.webmanifest        metadados de aplicativo (PWA)
sw.js                       cache offline
icone.svg                   ícone
.nojekyll                   impede o processamento Jekyll no GitHub Pages
css/app.css                 estilos (tema claro e escuro, impressão)
js/app.js                   inicialização e rotas
js/schema.js                catálogo de documentos, resolução de $ref, domínios
js/validator.js             validação contra o JSON Schema e progresso
js/store.js                 persistência (IndexedDB/localStorage)
js/exportar.js              geração do JSON e nome de arquivo
js/ui/form.js               motor de formulário dirigido por schema
js/ui/shell.js              notificações e diálogos
js/views/home.js            lista, criação, importação, backup
js/views/editor.js          edição, validação, abas
js/views/conferencia.js     totais, cruzamentos e pendências
js/views/docs.js            aba “Documentação” (manuais e leiaute)
docs/*.pdf                  manuais oficiais do TCE-SP
js/views/ajuda.js           página “Como usar”
dados/*.json                schemas oficiais e arquivos de exemplo (v1.16)
```

---

## Atualizar para um leiaute novo do Audesp (v1.17, v1.18…)

1. Coloque os novos arquivos em `dados/` mantendo o padrão de nome:
   `prestacao_contas_convenio_schema_v1_17.json`, `prestacao_contas_convenio_v1_17.json`, etc.
2. Em `js/schema.js`, altere:
   ```js
   export const VERSAO_SCHEMA = 'v1_17';
   export const ROTULO_VERSAO = 'v1.17';
   ```
3. Ajuste `sw.js` (lista `ESSENCIAIS` e a constante `VERSAO`) para forçar a atualização do cache.
4. Se o leiaute criar seções novas, acrescente-as em `GRUPOS` no `js/schema.js`; se não forem
   mapeadas, elas aparecem automaticamente no grupo “Outros”.

---

## Testar localmente

```bash
cd audesp-pc
python -m http.server 8000
```

Abra <http://localhost:8000>. Abrir o `index.html` direto pelo explorador de arquivos (`file://`)
**não funciona**, porque o navegador bloqueia a leitura dos schemas em `dados/`.

---

## Limites e responsabilidade

- A validação reproduz o **schema**; ela não substitui as regras de negócio do Audesp nem o manual oficial
  (cruzamentos contábeis complexos, exigências de comprovação, prazos).
- Nada é enviado ao TCE automaticamente: o sistema apenas **gera o arquivo** para o envio no Audesp.
- A conferência final e o envio são de responsabilidade do órgão.

Referências: [Audesp — TCE-SP](https://audesp.tce.sp.gov.br) · [Manuais e leiautes](https://www.tce.sp.gov.br/audesp)
