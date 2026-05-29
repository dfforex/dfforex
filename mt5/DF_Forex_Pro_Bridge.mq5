//+------------------------------------------------------------------+
//| DF Forex Pro Bridge v3.4                                         |
//| Painel Netlify/Supabase -> MetaTrader 5                          |
//| Coloque este arquivo em MQL5/Experts e compile no MetaEditor.     |
//+------------------------------------------------------------------+
#property strict
#property version   "3.40"
#property description "DF Forex Pro MT5 Bridge: recebe comandos do painel e executa estratégia básica em conta MT5."

#include <Trade/Trade.mqh>
CTrade trade;

input string BridgeBaseUrl = "https://df-forex.netlify.app";
input string BridgeId = "df-forex-main";
input string BridgeSecret = "df_forex_bridge_teste_2026_05_29_trocar_depois";
input bool   AllowRealTrading = false;
input bool   StartPaused = true;
input string SymbolsCsv = "EURUSD,GBPUSD,USDJPY,XAUUSD";
input double FixedLot = 0.01;
input double RiskPerTradePct = 0.50;
input int    ScanIntervalSeconds = 60;
input int    MinSignalScore = 80;
input int    StopLossPoints = 250;
input int    TakeProfitPoints = 500;
input int    MagicNumber = 314159;

bool g_bot_running = false;
datetime g_last_scan = 0;
string g_last_error = "";
int g_last_http_code = 0;
string g_last_http_path = "";
string g_last_http_response = "";

void UpdateChartComment() {
  string status = g_bot_running ? "RODANDO" : "PAUSADO";
  Comment(
    "DF Forex Pro Bridge v3.4\n",
    "Status: ", status, "\n",
    "BridgeId: ", BridgeId, "\n",
    "Servidor: ", AccountInfoString(ACCOUNT_SERVER), " | Login: ", IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)), "\n",
    "Terminal conectado: ", (TerminalInfoInteger(TERMINAL_CONNECTED) ? "SIM" : "NAO"), "\n",
    "Trading permitido: ", ((TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) && MQLInfoInteger(MQL_TRADE_ALLOWED)) ? "SIM" : "NAO"), "\n",
    "Ultimo HTTP: ", IntegerToString(g_last_http_code), " em ", g_last_http_path, "\n",
    "Ultimo erro: ", g_last_error
  );
}

int OnInit() {
  g_bot_running = !StartPaused;
  trade.SetExpertMagicNumber(MagicNumber);
  EventSetTimer(5);
  ReportStatus("init", "EA iniciado");
  UpdateChartComment();
  return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
  EventKillTimer();
  ReportStatus("deinit", "EA finalizado");
  Comment("");
}

void OnTimer() {
  PollCommand();
  ReportStatus("heartbeat", "Heartbeat MT5 Bridge");
  if(g_bot_running && TimeCurrent() - g_last_scan >= ScanIntervalSeconds) {
    g_last_scan = TimeCurrent();
    RunStrategyScan();
  }
  UpdateChartComment();
}

void OnTick() {}

string Trim(string s) { StringTrimLeft(s); StringTrimRight(s); return s; }

int SplitCsv(string csv, string &arr[]) {
  string tmp = csv;
  int n = StringSplit(tmp, ',', arr);
  for(int i=0;i<n;i++) arr[i]=Trim(arr[i]);
  return n;
}

string EscapeJson(string s) {
  StringReplace(s, "\\", "\\\\");
  StringReplace(s, "\"", "\\\"");
  StringReplace(s, "\r", " ");
  StringReplace(s, "\n", " ");
  return s;
}

string HttpRequest(string method, string path, string body="") {
  string url = BridgeBaseUrl + "/.netlify/functions/" + path;
  string headers = "Content-Type: application/json\r\nX-Bridge-Id: " + BridgeId + "\r\nX-Bridge-Secret: " + BridgeSecret + "\r\n";
  char data[];
  char result[];
  string result_headers;
  StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
  ResetLastError();
  int code = WebRequest(method, url, headers, 15000, data, result, result_headers);
  g_last_http_code = code;
  g_last_http_path = path;
  if(code == -1) {
    int err = GetLastError();
    g_last_error = "WebRequest falhou. Erro " + IntegerToString(err) + ". Libere WebRequest para " + BridgeBaseUrl + " em Ferramentas > Opcoes > Expert Advisors.";
    Print("DF Forex Pro Bridge: ", g_last_error);
    UpdateChartComment();
    return "";
  }
  string response = CharArrayToString(result, 0, -1, CP_UTF8);
  g_last_http_response = response;
  if(code < 200 || code >= 300) {
    g_last_error = "HTTP " + IntegerToString(code) + " em " + path + ". Resposta: " + response;
    Print("DF Forex Pro Bridge: ", g_last_error);
    UpdateChartComment();
    return "";
  }
  g_last_error = "";
  return response;
}


string JsonGetString(string json, string key) {
  string needle = "\"" + key + "\"";
  int p = StringFind(json, needle);
  if(p < 0) return "";
  p = StringFind(json, ":", p);
  if(p < 0) return "";
  int q = StringFind(json, "\"", p+1);
  if(q < 0) return "";
  int r = StringFind(json, "\"", q+1);
  if(r < 0) return "";
  return StringSubstr(json, q+1, r-q-1);
}

void PollCommand() {
  string response = HttpRequest("GET", "mt5-bridge-poll?bridge_id=" + BridgeId, "");
  if(response == "") return;
  string cmdId = JsonGetString(response, "id");
  string action = JsonGetString(response, "action");
  if(action == "") return;

  string msg = "Comando recebido: " + action;
  bool ok = true;
  if(action == "START_BOT") { g_bot_running = true; }
  else if(action == "PAUSE_BOT") { g_bot_running = false; }
  else if(action == "RUN_SCAN") { RunStrategyScan(); }
  else if(action == "CLOSE_ALL") { CloseAllPositions(); }
  else if(action == "SYNC_NOW") { }
  else { ok = false; msg = "Comando não reconhecido: " + action; }

  string ack = "{\"bridge_id\":\""+BridgeId+"\",\"event\":\"command_ack\",\"message\":\""+EscapeJson(msg)+"\",\"command_ack\":{\"id\":\""+cmdId+"\",\"status\":\""+(ok?"done":"error")+"\",\"action\":\""+action+"\"}}";
  HttpRequest("POST", "mt5-bridge-report", ack);
}

void ReportStatus(string eventName, string message) {
  bool connected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);
  bool tradeAllowed = (bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) && (bool)MQLInfoInteger(MQL_TRADE_ALLOWED);
  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  double margin = AccountInfoDouble(ACCOUNT_MARGIN);
  double freeMargin = AccountInfoDouble(ACCOUNT_FREEMARGIN);
  long login = AccountInfoInteger(ACCOUNT_LOGIN);
  string name = AccountInfoString(ACCOUNT_NAME);
  string server = AccountInfoString(ACCOUNT_SERVER);
  int positions = PositionsTotal();
  string payload = "{"
    + "\"bridge_id\":\""+BridgeId+"\","
    + "\"status\":\"online\","
    + "\"event\":\""+EscapeJson(eventName)+"\","
    + "\"message\":\""+EscapeJson(message)+"\","
    + "\"bot_running\":"+(g_bot_running?"true":"false")+"," 
    + "\"account_login\":\""+IntegerToString(login)+"\","
    + "\"account_name\":\""+EscapeJson(name)+"\","
    + "\"account_server\":\""+EscapeJson(server)+"\","
    + "\"account_type\":\""+(IsRealAccount()?"real":"demo")+"\","
    + "\"balance\":"+DoubleToString(balance,2)+"," 
    + "\"equity\":"+DoubleToString(equity,2)+"," 
    + "\"margin\":"+DoubleToString(margin,2)+"," 
    + "\"free_margin\":"+DoubleToString(freeMargin,2)+"," 
    + "\"open_positions\":"+IntegerToString(positions)+"," 
    + "\"terminal_connected\":"+(connected?"true":"false")+"," 
    + "\"trade_allowed\":"+(tradeAllowed?"true":"false")+"," 
    + "\"last_error\":\""+EscapeJson(g_last_error)+"\""
    + "}";
  HttpRequest("POST", "mt5-bridge-report", payload);
}

bool IsRealAccount() {
  // MQL5 não expõe sempre um flag confiável para demo/real em todos os brokers;
  // usamos servidor contendo Demo como trava adicional.
  string server = AccountInfoString(ACCOUNT_SERVER);
  string lower = server;
  StringToLower(lower);
  return StringFind(lower, "demo") < 0;
}

void RunStrategyScan() {
  string symbols[];
  int n = SplitCsv(SymbolsCsv, symbols);
  for(int i=0;i<n;i++) {
    string sym = symbols[i];
    if(sym == "") continue;
    if(!SymbolSelect(sym, true)) continue;
    ScanSymbol(sym);
  }
}

void ScanSymbol(string sym) {
  int score = 0;
  string direction = "";
  double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
  double bid = SymbolInfoDouble(sym, SYMBOL_BID);
  double point = SymbolInfoDouble(sym, SYMBOL_POINT);
  if(ask <= 0 || bid <= 0 || point <= 0) return;

  double ema50_h1 = GetMA(sym, PERIOD_H1, 50, 0);
  double ema200_h1 = GetMA(sym, PERIOD_H1, 200, 0);
  double ema50_h4 = GetMA(sym, PERIOD_H4, 50, 0);
  double ema200_h4 = GetMA(sym, PERIOD_H4, 200, 0);
  double close_m15 = iClose(sym, PERIOD_M15, 1);
  double open_m15 = iOpen(sym, PERIOD_M15, 1);

  if(ema50_h1 == 0 || ema200_h1 == 0 || ema50_h4 == 0 || ema200_h4 == 0 || close_m15 == 0) return;

  if(ema50_h4 > ema200_h4) score += 25;
  if(ema50_h1 > ema200_h1) score += 25;
  if(close_m15 > ema50_h1) score += 15;
  if(close_m15 > open_m15) score += 10;
  double spreadPoints = (ask - bid) / point;
  if(spreadPoints < 40) score += 10;
  score += 15; // risco/recompensa pré-configurada SL/TP 1:2
  if(ema50_h4 > ema200_h4 && ema50_h1 > ema200_h1 && close_m15 > open_m15) direction = "buy";

  if(direction == "") {
    score = 0;
    if(ema50_h4 < ema200_h4) score += 25;
    if(ema50_h1 < ema200_h1) score += 25;
    if(close_m15 < ema50_h1) score += 15;
    if(close_m15 < open_m15) score += 10;
    if(spreadPoints < 40) score += 10;
    score += 15;
    if(ema50_h4 < ema200_h4 && ema50_h1 < ema200_h1 && close_m15 < open_m15) direction = "sell";
  }

  bool approved = (direction != "" && score >= MinSignalScore);
  string signalJson = "{\"symbol\":\""+sym+"\",\"strategy_name\":\"DF Trend Pullback Core\",\"direction\":\""+direction+"\",\"score\":"+IntegerToString(score)+",\"approved\":"+(approved?"true":"false")+",\"spread_points\":"+DoubleToString(spreadPoints,1)+",\"rejection_reason\":\""+(approved?"":"Score baixo ou sem direção")+"\"}";
  string payload = "{\"bridge_id\":\""+BridgeId+"\",\"event\":\"signal\",\"message\":\"Sinal avaliado\",\"signals\":["+signalJson+"]}";
  HttpRequest("POST", "mt5-bridge-report", payload);

  if(approved && CanOpenTrade(sym)) {
    OpenTrade(sym, direction, score, spreadPoints);
  }
}

double GetMA(string sym, ENUM_TIMEFRAMES tf, int period, int shift) {
  int handle = iMA(sym, tf, period, 0, MODE_EMA, PRICE_CLOSE);
  if(handle == INVALID_HANDLE) return 0;
  double buffer[];
  ArraySetAsSeries(buffer, true);
  int copied = CopyBuffer(handle, 0, shift, 1, buffer);
  IndicatorRelease(handle);
  if(copied <= 0) return 0;
  return buffer[0];
}

bool CanOpenTrade(string sym) {
  if(IsRealAccount() && !AllowRealTrading) {
    g_last_error = "Conta real detectada, mas AllowRealTrading=false no EA.";
    return false;
  }
  if(!(bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !(bool)MQLInfoInteger(MQL_TRADE_ALLOWED)) {
    g_last_error = "Trading não permitido no terminal/EA.";
    return false;
  }
  for(int i=0;i<PositionsTotal();i++) {
    ulong ticket = PositionGetTicket(i);
    if(ticket > 0 && PositionSelectByTicket(ticket)) {
      if(PositionGetString(POSITION_SYMBOL) == sym && PositionGetInteger(POSITION_MAGIC) == MagicNumber) return false;
    }
  }
  return true;
}

void OpenTrade(string sym, string direction, int score, double spreadPoints) {
  double point = SymbolInfoDouble(sym, SYMBOL_POINT);
  double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
  double bid = SymbolInfoDouble(sym, SYMBOL_BID);
  double price = (direction == "buy") ? ask : bid;
  double sl = (direction == "buy") ? price - StopLossPoints * point : price + StopLossPoints * point;
  double tp = (direction == "buy") ? price + TakeProfitPoints * point : price - TakeProfitPoints * point;
  bool ok = false;
  if(direction == "buy") ok = trade.Buy(FixedLot, sym, price, sl, tp, "DF Forex Pro");
  if(direction == "sell") ok = trade.Sell(FixedLot, sym, price, sl, tp, "DF Forex Pro");
  ulong ticket = trade.ResultOrder();
  double profit = 0;
  string status = ok ? "open" : "error";
  if(!ok) g_last_error = "Falha ao abrir ordem: " + trade.ResultRetcodeDescription();

  string orderJson = "{\"ticket\":\""+IntegerToString((long)ticket)+"\",\"symbol\":\""+sym+"\",\"direction\":\""+direction+"\",\"lot_size\":"+DoubleToString(FixedLot,2)+",\"entry_price\":"+DoubleToString(price,(int)SymbolInfoInteger(sym, SYMBOL_DIGITS))+",\"stop_loss\":"+DoubleToString(sl,(int)SymbolInfoInteger(sym, SYMBOL_DIGITS))+",\"take_profit\":"+DoubleToString(tp,(int)SymbolInfoInteger(sym, SYMBOL_DIGITS))+",\"status\":\""+status+"\",\"profit\":"+DoubleToString(profit,2)+",\"spread_at_entry\":"+DoubleToString(spreadPoints,1)+",\"strategy_name\":\"DF Trend Pullback Core\"}";
  string payload = "{\"bridge_id\":\""+BridgeId+"\",\"event\":\"order\",\"message\":\"Ordem " + (ok?"aberta":"rejeitada") + "\",\"orders\":["+orderJson+"]}";
  HttpRequest("POST", "mt5-bridge-report", payload);
}

void CloseAllPositions() {
  for(int i=PositionsTotal()-1;i>=0;i--) {
    ulong ticket = PositionGetTicket(i);
    if(ticket > 0 && PositionSelectByTicket(ticket)) {
      if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) trade.PositionClose(ticket);
    }
  }
}
