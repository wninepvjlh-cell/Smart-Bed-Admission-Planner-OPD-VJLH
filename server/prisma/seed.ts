import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { name: 'admin', description: 'System administrator' },
    { name: 'opd', description: 'Outpatient department nurse' },
    { name: 'ipd', description: 'Inpatient department nurse' }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role
    });
  }

  const users = [
    {
      username: 'admin',
      displayName: 'Administrator',
      role: 'admin',
      password: 'sorninecodenursevjlh'
    },
    {
      username: 'opd',
      displayName: 'พยาบาล OPD',
      role: 'opd',
      password: 'nurseopd9'
    },
    {
      username: 'ipd',
      displayName: 'พยาบาล IPD',
      role: 'ipd',
      password: 'nurseipd'
    }
  ];

  for (const user of users) {
    const role = await prisma.role.findUnique({ where: { name: user.role } });
    if (!role) {
      throw new Error(`Role ${user.role} not found while seeding users`);
    }

    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        displayName: user.displayName,
        roleId: role.id,
        passwordHash,
        isActive: true
      },
      create: {
        username: user.username,
        displayName: user.displayName,
        roleId: role.id,
        passwordHash,
        isActive: true
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seeding failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
