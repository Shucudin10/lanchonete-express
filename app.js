$(document).ready(function () {

  const STORAGE_KEY = 'lanchonete_express_pedido';
  let cupomAtivo = null; // { codigo, percentual }

  /* ---------------- Utilitários ---------------- */

  function formatarMoeda(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
  }

  /* ---------------- Núcleo de Cálculo ---------------- */

  function calcularTotal() {
    const $selectLanche = $('#select-lanche');
    const precoLanche = parseFloat($selectLanche.val()) || 0;
    const nomeLanche = $selectLanche.find(':selected').data('nome') || 'Selecione um lanche';

    let somaAdicionais = 0;
    $('.check-adicional:checked').each(function () {
      somaAdicionais += parseFloat($(this).val()) || 0;
    });

    let qtd = parseInt($('#input-qtd').val()) || 1;
    if (qtd < 1) qtd = 1;

    const precoUnitario = precoLanche + somaAdicionais;
    const subtotal = precoUnitario * qtd;

    const taxaEntrega = parseFloat($('#select-entrega').val()) || 0;

    let desconto = 0;
    if (cupomAtivo) {
      desconto = subtotal * (cupomAtivo.percentual / 100);
    }

    const totalGeral = Math.max(subtotal + taxaEntrega - desconto, 0);

    // Atualiza o "ticket"
    $('#resumo-item').text(nomeLanche);
    $('#resumo-lanche').text(formatarMoeda(precoLanche));
    $('#resumo-adicionais').text(formatarMoeda(somaAdicionais));
    $('#resumo-qtd').text('×' + qtd);
    $('#resumo-subtotal').text(formatarMoeda(subtotal));
    $('#resumo-entrega').text(formatarMoeda(taxaEntrega));

    if (desconto > 0) {
      $('#linha-desconto').removeClass('d-none');
      $('#resumo-desconto').text('− ' + formatarMoeda(desconto));
    } else {
      $('#linha-desconto').addClass('d-none');
    }

    $('#total-geral').text(formatarMoeda(totalGeral));

    return { nomeLanche, precoLanche, somaAdicionais, qtd, subtotal, taxaEntrega, desconto, totalGeral };
  }

  /* ---------------- Adicionais: nomes selecionados (para persistência) ---------------- */

  function listarAdicionaisSelecionados() {
    const nomes = [];
    $('.check-adicional:checked').each(function () {
      nomes.push($(this).data('nome'));
    });
    return nomes;
  }

  /* ---------------- Quantidade (+ / -) ---------------- */

  $('#btn-mais').on('click', function () {
    const $input = $('#input-qtd');
    let val = parseInt($input.val()) || 1;
    $input.val(val + 1);
    calcularTotal();
  });

  $('#btn-menos').on('click', function () {
    const $input = $('#input-qtd');
    let val = parseInt($input.val()) || 1;
    if (val > 1) $input.val(val - 1);
    calcularTotal();
  });

  /* ---------------- Cupom de desconto ---------------- */

  const CUPONS_VALIDOS = {
    'BEMVINDO10': 10,
    'EXPRESS15': 15,
    '20': 20
  };

  $('#btn-cupom').on('click', function () {
    const codigo = $('#input-cupom').val().trim().toUpperCase();
    const $feedback = $('#cupom-feedback').removeClass('d-none ok erro');

    if (!codigo) {
      $feedback.addClass('erro').text('Digite um código de cupom.');
      cupomAtivo = null;
      calcularTotal();
      return;
    }

    if (CUPONS_VALIDOS.hasOwnProperty(codigo)) {
      cupomAtivo = { codigo: codigo, percentual: CUPONS_VALIDOS[codigo] };
      $feedback.addClass('ok').text('Cupom "' + codigo + '" aplicado: -' + cupomAtivo.percentual + '% no subtotal.');
    } else {
      cupomAtivo = null;
      $feedback.addClass('erro').text('Cupom inválido ou expirado.');
    }

    calcularTotal();
  });

  /* ---------------- Escutadores em tempo real ---------------- */

  $('#select-lanche, #select-entrega, .check-adicional').on('change', calcularTotal);
  $('#input-qtd').on('input change', calcularTotal);

  /* ---------------- Persistência no LocalStorage ---------------- */

  function mostrarSelo() {
    const $stamp = $('#ticket-stamp');
    $stamp.addClass('show');
    setTimeout(function () { $stamp.removeClass('show'); }, 1600);
  }

  $('#btn-finalizar').on('click', function () {
    const dados = calcularTotal();

    const pedido = {
      lanche: $('#select-lanche').val(),
      nomeLanche: dados.nomeLanche,
      adicionais: listarAdicionaisSelecionados(),
      qtd: $('#input-qtd').val(),
      entrega: $('#select-entrega').val(),
      cupom: cupomAtivo,
      totalGeral: dados.totalGeral,
      salvoEm: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pedido));

    mostrarSelo();
    $('#save-feedback')
      .removeClass('d-none')
      .html('<i class="bi bi-cloud-check"></i> Pedido salvo no navegador às ' +
            new Date().toLocaleTimeString('pt-BR') + '.');
  });

  $('#btn-limpar').on('click', function () {
    localStorage.removeItem(STORAGE_KEY);

    $('#select-lanche').val('0');
    $('.check-adicional').prop('checked', false);
    $('#input-qtd').val(1);
    $('#select-entrega').val('7.00');
    $('#input-cupom').val('');
    cupomAtivo = null;
    $('#cupom-feedback').addClass('d-none');
    $('#save-feedback').addClass('d-none');

    calcularTotal();
  });

  function restaurarPedido() {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return;

    try {
      const pedido = JSON.parse(salvo);

      if (pedido.lanche) $('#select-lanche').val(pedido.lanche);
      if (pedido.entrega) $('#select-entrega').val(pedido.entrega);
      if (pedido.qtd) $('#input-qtd').val(pedido.qtd);

      if (Array.isArray(pedido.adicionais)) {
        $('.check-adicional').each(function () {
          const nome = $(this).data('nome');
          $(this).prop('checked', pedido.adicionais.indexOf(nome) !== -1);
        });
      }

      if (pedido.cupom && pedido.cupom.codigo) {
        cupomAtivo = pedido.cupom;
        $('#input-cupom').val(pedido.cupom.codigo);
        $('#cupom-feedback').removeClass('d-none erro').addClass('ok')
          .text('Cupom "' + pedido.cupom.codigo + '" aplicado: -' + pedido.cupom.percentual + '% no subtotal.');
      }

      $('#save-feedback')
        .removeClass('d-none')
        .html('<i class="bi bi-clock-history"></i> Rascunho restaurado do último pedido salvo.');
    } catch (e) {
      console.error('Não foi possível restaurar o pedido salvo:', e);
    }
  }

  /* ---------------- Inicialização ---------------- */

  restaurarPedido();
  calcularTotal();
});