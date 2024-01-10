import db from "@/drizzle/schema";

export default async function rmExpiredSessions() {
  // await prisma.amcatSession.deleteMany({
  //   where: {
  //     OR: [
  //       {
  //         expires: {
  //           lte: new Date(Date.now()),
  //         },
  //       },
  //       {
  //         refreshExpires: {
  //           lte: new Date(Date.now()),
  //         },
  //       },
  //     ],
  //   },
  // });
}
