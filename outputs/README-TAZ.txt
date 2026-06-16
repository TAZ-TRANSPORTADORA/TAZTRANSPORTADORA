APP TAZ Transportadora

Endereco publicado:
https://taztransportadora.netlify.app/

Arquivos principais:
- index.html: tela do aplicativo
- styles.css: visual do aplicativo
- app.js: salvamento local, exportacao CSV, multiplos abastecimentos e leitura de codigo pela camera
- manifest.json: configuracao para instalacao no Android como app/PWA
- taz-logo.jpeg: logo original usado na tela
- taz-icon-512.jpeg: icone quadrado para instalacao
- Consolidado_TAZ_integrado.xlsx: copia da base com abas APP_VIAGENS e APP_ABASTECIMENTOS
- dashboard_taz_integrado.html: dashboard preparado para somar os dados enviados pelo app
- GUIA-SINCRONIZACAO.txt: configuracao do envio automatico Netlify/Power Automate
- GUIA-CADASTROS.txt: configuracao dos cadastros compartilhados
- GUIA-BASE-ONLINE.txt: configuracao da base central Netlify
- GUIA-LOGIN.txt: criacao de usuarios, senhas e perfis

Como testar no computador:
1. Abra o arquivo index.html no navegador.
2. Preencha os campos e clique em Salvar registro.
3. Em Abastecimentos, use Adicionar para registrar mais de um abastecimento na mesma viagem.
4. Use Exportar CSV para baixar os registros salvos.

Como alimentar o dashboard:
1. Use a planilha Consolidado_TAZ_integrado.xlsx como base inicial.
2. No app, abra a secao Base do dashboard.
3. Selecione a ultima versao da planilha consolidada.
4. Toque em Gerar base atualizada.
5. O app baixa uma nova planilha sem duplicar viagens e abastecimentos que ja tenham o mesmo ID.
6. Abra dashboard_taz_integrado.html.
7. Clique em Importar e selecione a planilha atualizada.
8. Clique em Salvar no dashboard para manter os dados no navegador.

Sincronizacao automatica:
- O projeto inclui uma funcao Netlify em netlify/functions/sync-excel.mjs.
- Ao salvar uma viagem no site publicado, o app tenta enviar automaticamente.
- Se estiver offline, o registro fica pendente e tenta novamente ao conectar.
- Consulte GUIA-SINCRONIZACAO.txt para configurar o Power Automate e a variavel
  POWER_AUTOMATE_URL no Netlify.

Base central:
- As viagens e os cadastros podem ser armazenados diretamente no Netlify Blobs.
- Configure somente TAZ_ADMIN_KEY para proteger a consulta e a exportacao.
- Consulte GUIA-BASE-ONLINE.txt.

Dados usados pelo dashboard:
- Viagens: data, motorista, empresa, categoria, placas e KM rodado.
- Abastecimentos: KM, litros, valor do diesel e chave da nota.
- A media KM/L e calculada pelo dashboard.
- Velocidade media e maxima continuam dependentes da fonte atual, pois o app nao mede velocidade.

Observacao sobre camera:
Para a leitura pela camera funcionar corretamente no Android, o app precisa rodar em uma origem segura, como HTTPS, localhost, ou estar empacotado como APK. Se abrir apenas como arquivo local, alguns navegadores podem bloquear a camera.

Proximo passo recomendado:
Automatizar o envio para a planilha no OneDrive com Power Automate. A estrutura das abas do app ja esta preparada para essa etapa.
