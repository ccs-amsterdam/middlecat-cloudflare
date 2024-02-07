import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import db from "@/drizzle/schema";
import { sendEmail } from "@/functions/email";

export const {
  handlers: { GET, POST },
  auth,
} = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  adapter: DrizzleAdapter(db),
  session: {
    maxAge: 60 * 60, // kill session after 1 hour idle
    updateAge: 60 * 30, // extend session if <= 30 minutes left
  },
  theme: {
    colorScheme: "dark",
    logo: "/logo.svg",
    brandColor: "#38c7b9",
    buttonText: "#000",
  },
  providers: [
    {
      id: "email",
      type: "email",
      from: "ignored",
      server: {},
      maxAge: 24 * 60 * 60,
      name: "Email",
      options: {},
      async sendVerificationRequest(params) {
        const { identifier, theme } = params;
        const url = new URL(params.url);
        const signInURL = new URL(`/auth/email?${url.searchParams}`, url.origin);
        const escapedHost = signInURL.host.replace(/\./g, "&#8203;.");

        await sendEmail({
          toName: "User",
          toEmail: identifier,
          subject: `Sign in to MiddleCat`,
          text: `Sign in to '${escapedHost}' by following this link: ${signInURL} \n\n. If you did not request this email you can safely ignore it.`,
          html: `<body style="background: #f9f9f9;"><table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;"> <tr> <td align="center" style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> Sign in to <strong>${escapedHost}</strong></td></tr><tr> <td align="center" style="padding: 20px 0;"> <table border="0" cellspacing="0" cellpadding="0"> <tr> <td align="center" style="border-radius: 5px;" bgcolor="${theme.brandColor}"><a href="${signInURL}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${theme.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${theme.brandColor}; display: inline-block; font-weight: bold;">Sign in</a></td></tr></table> </td></tr><tr> <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> If you did not request this email you can safely ignore it. </td></tr></table></body>`,
        });
      },
    },
    GithubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
});
