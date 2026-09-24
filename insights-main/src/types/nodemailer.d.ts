declare namespace nodemailer {
  type Transporter = any;
}

declare module 'nodemailer' {
  export type Transporter = any;
  const nodemailer: any;
  export default nodemailer;
}
