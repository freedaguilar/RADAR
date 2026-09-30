import statusRedeHandler, { DEFAULT_SOMA_API_KEY } from "../status-rede";

export { DEFAULT_SOMA_API_KEY };
export default async function handler(req: any, res: any) {
  return statusRedeHandler(req, res);
}
