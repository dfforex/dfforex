//+------------------------------------------------------------------+
//| DF Forex Pro Bridge - Deriv MT5                                  |
//| Ponte segura entre o painel Netlify/Supabase e o MetaTrader 5.   |
//| Versao inicial: heartbeat + polling seguro sem ordem automatica. |
//+------------------------------------------------------------------+
#property strict
#property version   "2.70"
#property description "DF Forex Pro Bridge para Deriv MT5. Configure WebRequest e use primeiro em conta demo."

input string ApiBaseUrl      = "https://df-forex.netlify.app";
input string BridgeToken     = "COLE_AQUI_O_MT5_BRIDGE_TOKEN";
input int    PollSeconds     = 30;
input ulong  MagicNumber     = 27052026;
input bool   AllowTrading    = false; // Mantem bloqueado por padrao

string EndpointPoll() { return ApiBaseUrl + "/api/mt5-bridge-poll"; }
string EndpointReport() { return ApiBaseUrl + "/api/mt5-bridge-report"; }

int OnInit()
{
   EventSetTimer(MathMax(PollSeconds, 10));
   Print("DF Forex Pro Bridge iniciado. Lembre de liberar WebRequest para: ", ApiBaseUrl);
   SendHeartbeat();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("DF Forex Pro Bridge finalizado. Motivo: ", reason);
}

void OnTimer()
{
   SendHeartbeat();
}

void SendHeartbeat()
{
   string body = "{\"event\":\"heartbeat\",\"account\":\"" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) +
                 "\",\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) +
                 "\",\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) +
                 ",\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) +
                 ",\"symbol\":\"" + _Symbol + "\",\"allow_trading\":" + (AllowTrading ? "true" : "false") + "}";

   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + BridgeToken + "\r\n";
   char post[];
   StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   char result[];
   string result_headers = "";
   ResetLastError();
   int status = WebRequest("POST", EndpointPoll(), headers, 10000, post, result, result_headers);
   if(status == -1)
   {
      Print("DF Bridge WebRequest erro ", GetLastError(), ". Libere a URL em Tools > Options > Expert Advisors > Allow WebRequest.");
      return;
   }
   string response = CharArrayToString(result, 0, -1, CP_UTF8);
   Print("DF Bridge poll status=", status, " response=", response);

   // Segurança: esta versao nao executa ordens automaticamente.
   // Proxima etapa: ler fila de comandos validada pelo Risk Engine e executar via CTrade somente em DEMO.
}
