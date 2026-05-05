import { prisma } from "@/lib/prisma";
import { ContactCenterView } from "@/components/contacts/ContactCenterView";

async function getContactParties() {
  const parties = await prisma.party.findMany({
    orderBy: [{ outstanding: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      outstanding: true,
      salesperson: {
        select: {
          name: true,
        },
      },
    },
  });

  return parties.map((party) => ({
    id: party.id,
    name: party.name,
    phone: party.phone,
    email: party.email,
    address: party.address,
    outstanding: party.outstanding.toNumber(),
    salespersonName: party.salesperson.name,
  }));
}

export default async function ContactsPage() {
  const parties = await getContactParties();
  return <ContactCenterView parties={parties} />;
}
