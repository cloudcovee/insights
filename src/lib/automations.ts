import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Email Transport
let transporterPromise: Promise<nodemailer.Transporter>;

if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  // Use real Gmail if credentials are provided
  console.log('Using Gmail for sending automated emails.');
  transporterPromise = Promise.resolve(nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  }));
} else {
  // Fallback to Ethereal Testing Email
  console.log('No Gmail credentials found. Falling back to Ethereal testing mode.');
  let testAccountPromise = nodemailer.createTestAccount();
  transporterPromise = testAccountPromise.then((account: any) => {
    console.log('Test email account generated:', account.user);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass
      }
    });
  });
}

/**
 * Handle incoming analytics events and trigger relevant automations
 */
export async function triggerAutomations(event: any) {
  try {
    // We only care about identified users for email retargeting
    if (!event.userId) return;
    
    // Automation Rule 1: Product Viewed Retargeting
    if (event.event === 'Product Viewed') {
      await sendProductRetargetingEmail(event);
    }
    
  } catch (err) {
    console.error('Automation error:', err);
  }
}

async function sendProductRetargetingEmail(event: any) {
  const email = event.userId;
  const props = event.properties || {};
  const productName = props.productName || 'a product';
  
  // Format the email content
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #059669;">GoCart.</h2>
      <p style="font-size: 16px; color: #333;">Hi there,</p>
      <p style="font-size: 16px; color: #333;">We noticed you were checking out the <strong>${productName}</strong>. Excellent choice!</p>
      ${props.price ? `<p style="font-size: 18px; font-weight: bold;">Only ${props.price}</p>` : ''}
      <p style="font-size: 16px; color: #333;">Are you still interested? Stock is moving fast!</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="#" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to Store</a>
      </div>
    </div>
  `;

  const transporter = await transporterPromise;
  
  const info = await transporter.sendMail({
    from: '"GoCart Team" <hello@gocart.demo>',
    to: email,
    subject: `Still thinking about the ${productName}?`,
    html: htmlContent
  });

  console.log('----------------------------------------------------');
  console.log(`✉️ AUTOMATION TRIGGERED: Email sent to ${email}`);
  console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  console.log('----------------------------------------------------');
}
