APP TAZ Transportadora

Endereco publicado:
https://tazmotoristas.netlify.app/

Arquivos principais:
- index.html: tela do aplicativo
- styles.css: visual do aplicativo
- app.js: salvamento local, exportacao CSV, multiplos abastecimentos, anexos de despesas, manutencoes e leitura de codigo pela camera
- manifest.json: configuracao para instalacao no Android como app/PWA
- taz-logo.jpeg: logo original usado na tela
- taz-icon-512.jpeg: icone quadrado para instalacao
- dashboard_taz_integrado.html: dashboard preparado para somar os dados enviados pelo app
- GUIA-SINCRONIZACAO.txt: configuracao do envio automatico Netlify/Power Automate
- GUIA-CADASTROS.txt: configuracao dos cadastros compartilhados
- GUIA-BASE-ONLINE.txt: configuracao da base central Netlify
- GUIA-LOGIN.txt: criacao de usuarios, senhas e perfis
- GUIA-TORRE.txt: configuracao da integracao direta com Scania/rFMS

Como testar no computador:
1. Abra o arquivo index.html no navegador.
2. Preencha os campos e clique em Finalizar viagem.
3. Em Abastecimentos, use Adicionar para registrar mais de um abastecimento na mesma viagem.
4. Em Despesas da viagem, anexe uma foto do recibo ou nota quando houver.
5. Use a aba Manutencao para informar servicos preventivos ou corretivos.
6. Use Exportar CSV para baixar os registros salvos.

Como alimentar o dashboard:
1. Abra dashboard_taz_integrado.html no site publicado.
2. Entre com e-mail e senha do Supabase.
3. A Base online e a Scania/rFMS carregam automaticamente de acordo com
   o perfil do usuario.
4. A Torre continuara atualizando automaticamente a cada 2 minutos enquanto o
   dashboard estiver aberto.
5. Use Importar Excel somente quando precisar consultar uma planilha antiga.
6. Clique em Salvar no dashboard para manter os dados no navegador.

Sincronizacao automatica:
- O projeto inclui uma funcao Netlify em netlify/functions/sync-excel.mjs.
- Ao salvar uma viagem no site publicado, o app tenta enviar automaticamente.
- Ao salvar uma manutencao, o app tambem tenta enviar automaticamente.
- Se estiver offline, o registro fica pendente e tenta novamente ao conectar.
- Consulte GUIA-SINCRONIZACAO.txt para configurar o Power Automate e a variavel
  POWER_AUTOMATE_URL no Netlify.

Base central:
- As viagens e os cadastros podem ser armazenados diretamente no Netlify Blobs.
- Configure somente TAZ_ADMIN_KEY para proteger a consulta e a exportacao.
- Consulte GUIA-BASE-ONLINE.txt.
- O dashboard tambem pode consultar a base com login Supabase e filtro por empresa.

Scania/rFMS:
- O dashboard consulta a API oficial Scania Data Access por uma funcao Netlify.
- Configure SCANIA_RFMS_CONFIG_JSON no Netlify com as credenciais das empresas.
- Consulte GUIA-TORRE.txt.

Dados usados pelo dashboard:
- Viagens: data, motorista, empresa, categoria, placas, KM rodado e comprovante de despesa.
- Abastecimentos: KM, litros, valor do diesel e chave da nota.
- Manutencoes: data, tipo, motorista, empresa, placa, KM, descricao e observacao.
- Cadastro de motoristas: salario, diaria, comissao e parametros de KM/L
  Ruim, Bom e Excelente.
- A media KM/L e calculada pelo dashboard.
- Velocidade media e maxima continuam dependentes da fonte atual, pois o app nao mede velocidade.

Observacao sobre camera:
Para a leitura pela camera funcionar corretamente no Android, o app precisa rodar em uma origem segura, como HTTPS, localhost, ou estar empacotado como APK. Se abrir apenas como arquivo local, alguns navegadores podem bloquear a camera.

Proximo passo recomendado:
Automatizar o envio para a planilha no OneDrive com Power Automate. A estrutura das abas do app ja esta preparada para essa etapa.
