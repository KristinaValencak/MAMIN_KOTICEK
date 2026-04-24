const transporter = require("../config/email");

async function sendVerificationEmail(email, username, token) {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Potrdi svoj email naslov - Mamin Kotiček",
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Dobrodošla, ${username}!</h1>
            </div>
            <div class="content">
              <p>Hvala, ker si se registrirala na Mamin Kotiček!</p>
              <p>Za dokončanje registracije prosim potrdi svoj email naslov s klikom na spodnji gumb:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Potrdi Email</a>
              </div>
              <p>Če gumb ne deluje, kopiraj in prilepi naslednjo povezavo v svoj brskalnik:</p>
              <p style="word-break: break-all; color: #EC5F8C;">${verificationUrl}</p>
              <p><strong>Ta povezava bo veljavna 24 ur.</strong></p>
              <p>Če se nisi registrirala na našo stran, prosim ignoriraj ta email.</p>
            </div>
            <div class="footer">
              <p>© 2026 Mamin Kotiček. Vse pravice pridržane.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    text: `
        Dobrodošla, ${username}!
        
        Hvala, ker si se registrirala na Mamin Kotiček!
        
        Za dokončanje registracije prosim potrdi svoj email naslov s klikom na naslednjo povezavo:
        ${verificationUrl}
        
        Ta povezava bo veljavna 24 ur.
        
        Če se nisi registrirala na našo stran, prosim ignoriraj ta email.
        
        © 2026 Mamin Kotiček
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

async function sendCommentReportEmail(commentContent, commentAuthor, commentId, postTitle, postId, reason, reporterEmail = null) {
  const reportEmail = process.env.REPORT_EMAIL || process.env.EMAIL_FROM;
  const postUrl = `${process.env.FRONTEND_URL}/forum?post=${postId}`;

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: reportEmail,
    subject: `Prijava neprimernega komentarja - "${postTitle}"`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 24px; background: #d32f2f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Prijava neprimerega komentarja</h1>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>Objava:</strong><br>
                ${postTitle}
              </div>
              <div class="info-box">
                <strong>Komentar:</strong><br>
                ${commentContent.replace(/\n/g, '<br>')}
              </div>
              <div class="info-box">
                <strong>Avtor komentarja:</strong><br>
                ${commentAuthor || 'Neznano'}
              </div>
              <div class="info-box">
                <strong>ID komentarja:</strong><br>
                ${commentId}
              </div>
              ${reporterEmail ? `<div class="info-box"><strong>Email prijavitelja:</strong><br>${reporterEmail}</div>` : ''}
              <div class="info-box">
                <strong>Razlog prijave:</strong><br>
                ${reason.replace(/\n/g, '<br>')}
              </div>
              <p style="text-align: center;">
                <a href="${postUrl}" class="button">Oglej si objavo</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    text: `
  Prijava neprimerega komentarja
  
  Objava: ${postTitle}
  Komentar: ${commentContent}
  Avtor komentarja: ${commentAuthor || 'Neznano'}
  ID komentarja: ${commentId}
  ${reporterEmail ? `Email prijavitelja: ${reporterEmail}\n` : ''}
  Razlog prijave:
  ${reason}
  
  Oglej si objavo: ${postUrl}
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Comment report email sent for comment ${commentId}`);
  } catch (error) {
    console.error("Error sending comment report email:", error);
    throw error;
  }
}

async function sendPasswordResetEmail(email, username, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Ponastavitev gesla - Mamin Kotiček",
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ponastavitev gesla</h1>
            </div>
            <div class="content">
              <p>Pozdravljena, ${username}!</p>
              <p>Prejeli smo zahtevo za ponastavitev gesla za tvoj račun.</p>
              <p>Klikni na spodnji gumb za ponastavitev gesla:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Ponastavi geslo</a>
              </div>
              <p>Če gumb ne deluje, kopiraj in prilepi naslednjo povezavo v svoj brskalnik:</p>
              <p style="word-break: break-all; color: #EC5F8C;">${resetUrl}</p>
              <p><strong>Ta povezava bo veljavna 1 uro.</strong></p>
              <p>Če nisi zahtevala ponastavitve gesla, prosim ignoriraj ta email. Tvoje geslo ostane nespremenjeno.</p>
            </div>
            <div class="footer">
              <p>© 2026 Mamin Kotiček. Vse pravice pridržane.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    text: `
        Pozdravljena, ${username}!
        
        Prejeli smo zahtevo za ponastavitev gesla za tvoj račun.
        
        Klikni na naslednjo povezavo za ponastavitev gesla:
        ${resetUrl}
        
        Ta povezava bo veljavna 1 uro.
        
        Če nisi zahtevala ponastavitve gesla, prosim ignoriraj ta email. Tvoje geslo ostane nespremenjeno.
        
        © 2026 Mamin Kotiček
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

async function sendReportEmail(postTitle, postAuthor, postId, reason, reporterEmail = null) {
  const reportEmail = process.env.EMAIL_FROM;
  const postUrl = `${process.env.FRONTEND_URL}/forum?post=${postId}`;

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: reportEmail,
    subject: `Prijava neprimere objave - "${postTitle}"`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 24px; background: #d32f2f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Prijava neprimere objave</h1>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>Naslov objave:</strong><br>
                ${postTitle}
              </div>
              <div class="info-box">
                <strong>Avtor objave:</strong><br>
                ${postAuthor || 'Neznano'}
              </div>
              <div class="info-box">
                <strong>ID objave:</strong><br>
                ${postId}
              </div>
              ${reporterEmail ? `<div class="info-box"><strong>Email prijavitelja:</strong><br>${reporterEmail}</div>` : ''}
              <div class="info-box">
                <strong>Razlog prijave:</strong><br>
                ${reason.replace(/\n/g, '<br>')}
              </div>
              <p style="text-align: center;">
                <a href="${postUrl}" class="button">Oglej si objavo</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    text: `
  Prijava neprimere objave
  
  Naslov objave: ${postTitle}
  Avtor objave: ${postAuthor || 'Neznano'}
  ID objave: ${postId}
  ${reporterEmail ? `Email prijavitelja: ${reporterEmail}\n` : ''}
  Razlog prijave:
  ${reason}
  
  Oglej si objavo: ${postUrl}
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Report email sent for post ${postId}`);
  } catch (error) {
    console.error("Error sending report email:", error);
    throw error;
  }
}

async function sendMarketplaceReportEmail(listingTitle, listingAuthor, listingId, reason, reporterEmail = null) {
  const reportEmail = process.env.REPORT_EMAIL || process.env.EMAIL_FROM;
  const listingUrl = `${process.env.FRONTEND_URL}/marketplace/${listingId}`;

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: reportEmail,
    subject: `Prijava oglasa - "${listingTitle}"`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 24px; background: #d32f2f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Prijava oglasa</h1>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>Naslov oglasa:</strong><br>
                ${listingTitle}
              </div>
              <div class="info-box">
                <strong>Avtor oglasa:</strong><br>
                ${listingAuthor || 'Neznano'}
              </div>
              <div class="info-box">
                <strong>ID oglasa:</strong><br>
                ${listingId}
              </div>
              ${reporterEmail ? `<div class="info-box"><strong>Email prijavitelja:</strong><br>${reporterEmail}</div>` : ''}
              <div class="info-box">
                <strong>Razlog prijave:</strong><br>
                ${reason.replace(/\n/g, '<br>')}
              </div>
              <p style="text-align: center;">
                <a href="${listingUrl}" class="button">Oglej si oglas</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    text: `
  Prijava oglasa
  
  Naslov oglasa: ${listingTitle}
  Avtor oglasa: ${listingAuthor || 'Neznano'}
  ID oglasa: ${listingId}
  ${reporterEmail ? `Email prijavitelja: ${reporterEmail}\n` : ''}
  Razlog prijave:
  ${reason}
  
  Oglej si oglas: ${listingUrl}
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Marketplace report email sent for listing ${listingId}`);
  } catch (error) {
    console.error("Error sending marketplace report email:", error);
    throw error;
  }
}

async function sendContactEmail(name, email, subject, message) {
  const contactEmail = process.env.REPORT_EMAIL || process.env.EMAIL_FROM;

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: contactEmail,
    subject: `📧 Kontaktna forma: ${subject}`,
    replyTo: email,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #EC5F8C; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Novo kontaktno sporočilo</h1>
          </div>
          <div class="content">
            <div class="info-box">
              <strong>Ime:</strong><br>
              ${name}
            </div>
            <div class="info-box">
              <strong>Email:</strong><br>
              <a href="mailto:${email}">${email}</a>
            </div>
            <div class="info-box">
              <strong>Zadeva:</strong><br>
              ${subject}
            </div>
            <div class="info-box">
              <strong>Sporočilo:</strong><br>
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Novo kontaktno sporočilo

Ime: ${name}
Email: ${email}
Zadeva: ${subject}

Sporočilo:
${message}
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Contact email sent from ${email}`);
  } catch (error) {
    console.error("Error sending contact email:", error);
    throw error;
  }
}

async function sendProfileReportEmail(profileUsername, profileUserId, reason, reporterEmail = null) {
  const reportEmail = process.env.REPORT_EMAIL || process.env.EMAIL_FROM;
  const profileUrl = `${process.env.FRONTEND_URL}/user/${profileUserId}`;
  const safeReason = String(reason || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const mailOptions = {
    from: `"Mamin Kotiček" <${process.env.EMAIL_FROM}>`,
    to: reportEmail,
    subject: `Prijava neprimernega profila — @${profileUsername}`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #EC5F8C 0%, #F48FB1 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #EC5F8C; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 24px; background: #EC5F8C; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Prijava neprimernega profila</h1>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>Uporabniško ime:</strong><br>
                ${String(profileUsername || "").replace(/</g, "&lt;")}
              </div>
              <div class="info-box">
                <strong>ID uporabnika:</strong><br>
                ${profileUserId}
              </div>
              ${reporterEmail ? `<div class="info-box"><strong>Email prijavitelja:</strong><br>${String(reporterEmail).replace(/</g, "&lt;")}</div>` : ""}
              <div class="info-box">
                <strong>Razlog prijave:</strong><br>
                ${safeReason.replace(/\n/g, "<br>")}
              </div>
              <p style="text-align: center;">
                <a href="${profileUrl}" class="button">Odpri profil</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    text: `
Prijava neprimernega profila

Uporabniško ime: ${profileUsername}
ID uporabnika: ${profileUserId}
${reporterEmail ? `Email prijavitelja: ${reporterEmail}\n` : ""}
Razlog prijave:
${reason}

Profil: ${profileUrl}
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Profile report email sent for user ${profileUserId}`);
  } catch (error) {
    console.error("Error sending profile report email:", error);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReportEmail,
  sendCommentReportEmail,
  sendMarketplaceReportEmail,
  sendProfileReportEmail,
  sendContactEmail
};