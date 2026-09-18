# ELITE X — Preview

Protótipo front-end separado para a plataforma ELITE X.

## Arquivos

- `index.html` — estrutura da interface
- `style.css` — identidade visual e responsividade
- `app.js` — dados de demonstração, navegação e camada preparada para API

## Rodar no Termux

```bash
cd ~/SITES/elite-x-preview
python -m http.server 8080
```

Abra:

`http://127.0.0.1:8080`

## Próxima arquitetura

Frontend:
- HTML/CSS/JS agora
- futuramente Next.js/React, se necessário

Backend:
- API REST `/api/v1`
- autenticação
- perfis de criadores
- posts/conteúdo
- assinaturas
- checkout
- webhooks de pagamento
- painel do criador
- painel administrativo

Banco:
- usuários
- perfis
- conteúdo
- planos
- assinaturas
- compras
- pagamentos
- eventos/webhooks

Segurança:
- nunca colocar segredo de pagamento no `app.js`
- validar idade conforme a jurisdição e operação
- autorização no servidor
- senhas com hash
- rate limiting
- validação de uploads
- controle de acesso para conteúdo privado

O modo atual usa dados mock e não realiza pagamentos reais.
