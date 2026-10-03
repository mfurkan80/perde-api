import nodemailer from "nodemailer";
import "dotenv/config";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

const port = Number(SMTP_PORT ?? 465);
export const isMailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isMailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export const verifyMailConnection = async () => {
  if (!transporter) {
    console.log("E-posta kapalı: SMTP bilgileri .env'de yok.");
    return;
  }

  try {
    await transporter.verify();
    console.log(`E-posta hazır: ${SMTP_HOST}`);
  } catch (err) {
    console.log(
      "E-posta sunucusuna bağlanılamadı:",
      err instanceof Error ? err.message : err,
    );
  }
};

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export const sendMail = async (options: MailOptions): Promise<boolean> => {
  if (!transporter) {
    return false;
  }

  const info = await transporter.sendMail({
    from: MAIL_FROM ?? SMTP_USER,
    ...options,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`E-posta önizleme: ${previewUrl}`);
  }

  return true;
};
