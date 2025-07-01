// src/lib/authOptions.js
import GoogleProvider from "next-auth/providers/google"; // or your provider
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb"; // your existing MongoDB config

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // Add more providers here
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.role = token.role || "user";
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || "user";
      }
      return token;
    },
  },
};
