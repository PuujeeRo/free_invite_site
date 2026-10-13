export interface SendInviteParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  name: "resend" | "log" | "gmail";
  send(params: SendInviteParams): Promise<{ ok: boolean }>;
}
