import { linkWhatsapp } from './mensagem.js';

// Contrato Sender: objeto com `enviar(aluna, mensagem): Promise<void>`.
// Um futuro ApiSender (WhatsApp Business API) implementa o mesmo contrato.
export class WaMeSender {
  constructor(abrir = (url) => window.open(url, '_blank', 'noopener')) {
    this.abrir = abrir;
  }

  async enviar(aluna, mensagem) {
    this.abrir(linkWhatsapp(aluna.telefone, mensagem));
  }
}
