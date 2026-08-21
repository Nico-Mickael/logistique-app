const nodemailer = require('nodemailer');

const APP_NAME = 'Logistique ADES';

let transporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Envoie un email. Si SMTP n'est pas configuré (.env sans SMTP_HOST),
 * l'envoi est simplement journalisé — l'application fonctionne sans email.
 */
async function sendMail({ to, subject, text }) {
  if (!to) return;

  const t = getTransporter();
  if (!t) {
    console.log(`[mail] SMTP non configuré — email ignoré (à: ${to}) : ${subject}`);
    return;
  }

  try {
    await t.sendMail({
      from: `"${APP_NAME}" <${process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@logistique.local'}>`,
      to,
      subject,
      text,
    });
  } catch (err) {
    // Un échec d'email ne doit jamais casser le flux métier
    console.error('[mail] Erreur envoi :', err.message);
  }
}

const SUBJECTS = {
  approved: 'Demande validée',
  rejected: 'Demande refusée',
  rescheduled: 'Demande replanifiée',
  cancelled: 'Demande annulée',
  sortie_assignment: 'Assignation à une sortie',
  sortie_finished: 'Sortie terminée',
  return_marked: 'Retour enregistré',
};

exports.sendNotificationEmail = async (employee, notification) => {
  await sendMail({
    to: employee.email,
    subject: `${APP_NAME} — ${SUBJECTS[notification.type] || 'Notification'}`,
    text: `${notification.message}\n\n— ${APP_NAME}`,
  });
};
