import { withDeriv, authorizeIfToken } from './derivClient.js';

export function inferDerivAccountMode(loginid = '') {
  return /^VRTC/i.test(String(loginid || '')) ? 'demo' : 'real';
}

export function contractTypeFromDirection(direction = '') {
  const d = String(direction || '').toLowerCase();
  if (d === 'buy') return 'CALL';
  if (d === 'sell') return 'PUT';
  return null;
}

export async function getAuthorizedDerivAccount(token) {
  if (!token) throw new Error('Token Deriv não informado. Conecte a Deriv primeiro.');
  return await withDeriv(async (client) => {
    const auth = await authorizeIfToken(client, token);
    const balance = await client.request({ balance: 1 });
    const loginid = auth?.authorize?.loginid || '';
    return {
      ok: true,
      loginid,
      account_mode: inferDerivAccountMode(loginid),
      currency: balance?.balance?.currency || auth?.authorize?.currency || 'USD',
      balance: Number(balance?.balance?.balance || 0),
      fullname: auth?.authorize?.fullname || null,
      raw_authorize: auth?.authorize || null
    };
  });
}

export async function buyRiseFallContract({ token, signal, stake = 1, duration = 5, durationUnit = 'm', currency = 'USD' }) {
  if (!token) throw new Error('Token Deriv ausente.');
  if (!signal?.approved) throw new Error('Sinal não aprovado para execução.');
  const contractType = contractTypeFromDirection(signal.direction);
  if (!contractType) throw new Error(`Direção inválida para contrato Deriv: ${signal.direction}`);

  return await withDeriv(async (client) => {
    const account = await authorizeIfToken(client, token);
    const loginid = account?.authorize?.loginid || '';
    const proposal = await client.request({
      proposal: 1,
      amount: Number(stake),
      basis: 'stake',
      contract_type: contractType,
      currency,
      duration: Number(duration),
      duration_unit: durationUnit,
      symbol: signal.symbol
    }, 20000);

    const proposalId = proposal?.proposal?.id;
    const askPrice = Number(proposal?.proposal?.ask_price || stake);
    if (!proposalId) throw new Error('A Deriv não retornou proposal.id para compra.');

    const buy = await client.request({ buy: proposalId, price: askPrice }, 20000);
    const contractId = buy?.buy?.contract_id;
    let openContract = null;
    if (contractId) {
      try {
        const poc = await client.request({ proposal_open_contract: 1, contract_id: contractId }, 15000);
        openContract = poc?.proposal_open_contract || null;
      } catch (_) {
        openContract = null;
      }
    }

    return {
      ok: true,
      loginid,
      account_mode: inferDerivAccountMode(loginid),
      contract_type: contractType,
      contract_id: contractId,
      transaction_id: buy?.buy?.transaction_id,
      buy_price: Number(buy?.buy?.buy_price || askPrice || stake),
      payout: Number(buy?.buy?.payout || proposal?.proposal?.payout || 0),
      purchase_time: buy?.buy?.purchase_time || null,
      longcode: proposal?.proposal?.longcode || buy?.buy?.longcode || '',
      proposal: proposal?.proposal || null,
      open_contract: openContract,
      raw_buy: buy?.buy || null
    };
  });
}

export async function syncDerivContract({ token, contractId }) {
  if (!token) throw new Error('Token Deriv ausente.');
  if (!contractId) throw new Error('contractId ausente.');

  return await withDeriv(async (client) => {
    await authorizeIfToken(client, token);
    const poc = await client.request({ proposal_open_contract: 1, contract_id: Number(contractId) }, 15000);
    const c = poc?.proposal_open_contract || {};
    const profit = Number(c.profit ?? 0);
    const status = c.status || (c.is_sold ? (profit >= 0 ? 'won' : 'lost') : 'open');
    return {
      ok: true,
      contract_id: Number(contractId),
      status,
      is_sold: Boolean(c.is_sold),
      is_expired: Boolean(c.is_expired),
      profit,
      current_spot: c.current_spot,
      entry_tick: c.entry_tick,
      exit_tick: c.exit_tick,
      buy_price: c.buy_price,
      bid_price: c.bid_price,
      sell_time: c.sell_time || c.exit_tick_time || null,
      close_reason: status,
      raw: c
    };
  });
}
