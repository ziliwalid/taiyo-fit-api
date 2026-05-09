import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  const existing = await prisma.utilisateur.findUnique({ where: { email: 'malak@taiyofit.com' } })
  if (existing) {
    console.log('Malak existe déjà, seed ignoré.')
    return
  }

  const hash = await bcrypt.hash('malak2026', 10)

  const [user, coach] = await Promise.all([
    prisma.utilisateur.create({
      data: {
        email: 'malak@taiyofit.com',
        password: hash,
        nom: 'Joly',
        prenom: 'Malak',
        telephone: '',
        role: 'ADMIN'
      }
    }),
    prisma.coach.create({
      data: { nom: 'Joly', prenom: 'Malak' }
    })
  ])

  console.log(`Compte admin créé : ${user.email} (id=${user.id})`)
  console.log(`Coach créé : ${coach.prenom} ${coach.nom} (id=${coach.id})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
