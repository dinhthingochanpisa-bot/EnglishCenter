import {
  PrismaClient,
  Gender,
  LeadStatus,
  OpportunityStatus,
  ClassStatus,
  ContractStatus,
  PaymentScheduleStatus,
  StudentStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const CANONICAL_MODULES = [
  { code: 'CRM_LEADS', name: 'CRM Leads' },
  { code: 'SALES_PIPELINE', name: 'Sales Pipeline' },
  { code: 'FAMILY_PARENT', name: 'Family & Parent' },
  { code: 'STUDENT', name: 'Student' },
  { code: 'PROGRAM_PRODUCT', name: 'Program & Product' },
  { code: 'CLASS_ACADEMIC', name: 'Class & Academic' },
  { code: 'CONTRACT', name: 'Contract' },
  { code: 'PAYMENT_RECEIVABLE', name: 'Payment & Receivable' },
  { code: 'RENEWAL_RETENTION', name: 'Renewal & Retention' },
  { code: 'REPORTING', name: 'Reporting' },
  { code: 'NOTIFICATION', name: 'Notification' },
  { code: 'AUDIT_LOG', name: 'Audit Log' },
  { code: 'SETTINGS_ADMIN', name: 'Settings Admin' },
] as const;

const ROLE_DEFINITIONS = [
  { code: 'SUPER_ADMIN', name: 'Super Admin' },
  { code: 'ADMIN', name: 'Admin' },
  { code: 'MANAGER', name: 'Center Manager' },
  { code: 'SALES', name: 'Sales Consultant' },
  { code: 'CS', name: 'Customer Success' },
  { code: 'ACADEMIC', name: 'Academic Staff' },
  { code: 'ACCOUNTANT', name: 'Accountant' },
] as const;

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['*'],
  MANAGER: [
    'CRM_LEADS',
    'SALES_PIPELINE',
    'FAMILY_PARENT',
    'STUDENT',
    'CLASS_ACADEMIC',
    'CONTRACT',
    'PAYMENT_RECEIVABLE',
    'RENEWAL_RETENTION',
    'REPORTING',
    'AUDIT_LOG',
  ],
  SALES: ['CRM_LEADS', 'SALES_PIPELINE', 'FAMILY_PARENT', 'STUDENT', 'CONTRACT'],
  CS: ['FAMILY_PARENT', 'STUDENT', 'RENEWAL_RETENTION', 'NOTIFICATION'],
  ACADEMIC: ['STUDENT', 'PROGRAM_PRODUCT', 'CLASS_ACADEMIC'],
  ACCOUNTANT: ['CONTRACT', 'PAYMENT_RECEIVABLE', 'REPORTING', 'AUDIT_LOG'],
};

// Additional Granular Permissions for Phase 5
const ADDITIONAL_PERMISSIONS = [
  'CRM_LEADS.ASSIGN',
  'CRM_LEADS.CONVERT',
  'CRM_LEADS.INTERACT',
  'CRM_LEADS.TASK',
  'SALES_PIPELINE.WON',
];

const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] as const;

async function upsertCenter(prisma: PrismaClient, data: {
  code: string;
  name: string;
  address: string;
  phone: string;
}) {
  return prisma.center.upsert({
    where: { code: data.code },
    update: {
      name: data.name,
      address: data.address,
      phone: data.phone,
    },
    create: data,
  });
}

async function upsertUserAndCenters(
  prisma: PrismaClient,
  params: {
    email: string;
    fullName: string;
    roleId: string;
    passwordHash: string;
    centerIds: string[];
  },
) {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      fullName: params.fullName,
      roleId: params.roleId,
      password: params.passwordHash,
      isActive: true,
    },
    create: {
      email: params.email,
      fullName: params.fullName,
      roleId: params.roleId,
      password: params.passwordHash,
      isActive: true,
    },
  });

  await prisma.userCenter.deleteMany({ where: { userId: user.id } });
  if (params.centerIds.length > 0) {
    await prisma.userCenter.createMany({
      data: params.centerIds.map((centerId) => ({ userId: user.id, centerId })),
      skipDuplicates: true,
    });
  }

  return user;
}

async function main() {
  console.log('🌱 Starting Phase 6 Family & Student seed...');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Branding
    await prisma.brandingConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        appName: 'English Center CRM',
        shortName: 'EC CRM',
        primaryColor: '#2563eb',
        secondaryColor: '#475569',
        accentColor: '#10b981',
        headingFont: 'Inter',
        bodyFont: 'Inter',
        borderRadius: '12px',
      },
    });

    // 2. Centers
    const center01 = await upsertCenter(prisma, {
      code: 'CN01',
      name: 'Center Cau Giay',
      address: '1 Cau Giay, Ha Noi',
      phone: '02411112222',
    });
    const center02 = await upsertCenter(prisma, {
      code: 'CN02',
      name: 'Center Dong Da',
      address: '100 Xa Dan, Ha Noi',
      phone: '02433334444',
    });

    // 3. Permissions
    const permissionsByCode = new Map<string, string>();
    for (const moduleItem of CANONICAL_MODULES) {
      await prisma.moduleRegistry.upsert({
        where: { code: moduleItem.code },
        update: { name: moduleItem.name },
        create: { code: moduleItem.code, name: moduleItem.name },
      });

      for (const action of ACTIONS) {
        const code = `${moduleItem.code}.${action}`;
        const permission = await prisma.permission.upsert({
          where: { code },
          update: { name: `${action} ${moduleItem.name}` },
          create: { code, name: `${action} ${moduleItem.name}` },
        });
        permissionsByCode.set(permission.code, permission.id);
      }
    }

    for (const code of ADDITIONAL_PERMISSIONS) {
      const permission = await prisma.permission.upsert({
        where: { code },
        update: { name: code.replace('.', ' ') },
        create: { code, name: code.replace('.', ' ') },
      });
      permissionsByCode.set(permission.code, permission.id);
    }

    // 4. Roles
    const roleByCode = new Map<string, string>();
    for (const roleItem of ROLE_DEFINITIONS) {
      const role = await prisma.role.upsert({
        where: { code: roleItem.code },
        update: { name: roleItem.name },
        create: roleItem,
      });
      roleByCode.set(role.code, role.id);
    }

    await prisma.rolePermission.deleteMany();

    for (const roleItem of ROLE_DEFINITIONS) {
      const roleId = roleByCode.get(roleItem.code);
      if (!roleId) continue;

      const allowedModules = ROLE_PERMISSION_MAP[roleItem.code] ?? [];
      const permissionIds = allowedModules.includes('*')
          ? [...permissionsByCode.values()]
          : [...permissionsByCode.entries()]
              .filter(([code]) => {
                const module = code.split('.')[0];
                return allowedModules.includes(module) || allowedModules.includes(code);
              })
              .map(([, id]) => id);

      if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    }

    // 5. Users
    const passwordHash = await bcrypt.hash('password123', 10);
    const superAdmin = await upsertUserAndCenters(prisma, {
      email: 'superadmin@example.com',
      fullName: 'System Super Admin',
      roleId: roleByCode.get('SUPER_ADMIN')!,
      passwordHash,
      centerIds: [],
    });
    const manager01 = await upsertUserAndCenters(prisma, {
      email: 'manager01@example.com',
      fullName: 'Manager Cau Giay',
      roleId: roleByCode.get('MANAGER')!,
      passwordHash,
      centerIds: [center01.id],
    });
    const sales01 = await upsertUserAndCenters(prisma, {
      email: 'sales01@example.com',
      fullName: 'Sales Consultant 01',
      roleId: roleByCode.get('SALES')!,
      passwordHash,
      centerIds: [center01.id],
    });

    // 6. Academic Core
    let kidsProduct = await prisma.product.findFirst({
      where: { name: 'English for Kids' },
    });
    if (!kidsProduct) {
      kidsProduct = await prisma.product.create({
        data: { name: 'English for Kids', description: 'English for children 4-12' },
      });
    }

    const startersProgram = await prisma.program.upsert({
      where: { code: 'STARTERS' },
      update: { productId: kidsProduct.id },
      create: { code: 'STARTERS', name: 'Cambridge Starters', productId: kidsProduct.id },
    });

    let plan3M = await prisma.plan.findFirst({
      where: { programId: startersProgram.id, name: 'Plan 3M' },
    });
    if (!plan3M) {
      plan3M = await prisma.plan.create({
        data: {
          programId: startersProgram.id,
          name: 'Plan 3M',
          price: 12000000,
          durationMonths: 3,
          sessionCount: 24,
        },
      });
    }

    // 6.5 Phase 4 Sample Data: Academic & Finance
    console.log('Generating Phase 4 Academic & Finance samples...');
    
    await prisma.class.upsert({
      where: { code: 'CLS-CN01-001' },
      update: {},
      create: {
        code: 'CLS-CN01-001',
        name: 'Starters 1A',
        programId: startersProgram.id,
        centerId: center01.id,
        status: ClassStatus.ACTIVE,
        schedules: {
          create: [
            { dayOfWeek: 2, startTime: '18:00', endTime: '19:30', room: 'Room 101' },
            { dayOfWeek: 4, startTime: '18:00', endTime: '19:30', room: 'Room 101' },
          ]
        }
      }
    });

    // 7. Phase 5 Sample Data: Leads & Opportunities
    console.log('Generating Phase 5 CRM samples...');
    
    // Stage: NEW
    for (let i = 1; i <= 3; i++) {
      const parent = await prisma.parent.upsert({
        where: { phone: `090000000${i}` },
        update: {},
        create: { fullName: `Parent New ${i}`, phone: `090000000${i}`, email: `new${i}@example.com` }
      });
      await prisma.lead.create({
        data: {
          parentId: parent.id,
          centerId: center01.id,
          ownerId: sales01.id,
          status: LeadStatus.NEW,
          prospectiveStudentName: `Kid New ${i}`,
          grade: 'Grade 1',
          campaign: 'Facebook Ads',
        }
      });
    }

    // Stage: CONTACTED & NURTURING
    const parentNurture = await prisma.parent.upsert({
      where: { phone: '0911222333' },
      update: {},
      create: { fullName: 'Nguyen Van Nurture', phone: '0911222333' }
    });
    const leadNurture = await prisma.lead.create({
      data: {
        parentId: parentNurture.id,
        centerId: center01.id,
        ownerId: sales01.id,
        status: LeadStatus.NURTURING,
        prospectiveStudentName: 'Nguyen Be',
        target: 'IELTS Pre-starters',
        interactions: {
          create: [
            { actorId: sales01.id, type: 'CALL', content: 'Called but parent busy, follow up next week.' }
          ]
        },
        tasks: {
          create: [
            { title: 'Follow up call', assigneeId: sales01.id, dueDate: new Date(Date.now() + 86400000) }
          ]
        }
      }
    });

    // Stage: CONVERTED -> OPEN Opportunity
    const parentConv = await prisma.parent.upsert({
      where: { phone: '0922333444' },
      update: {},
      create: { fullName: 'Tran Thi Converted', phone: '0922333444' }
    });
    const leadConv = await prisma.lead.create({
      data: {
        parentId: parentConv.id,
        centerId: center01.id,
        ownerId: sales01.id,
        status: LeadStatus.CONVERTED,
        prospectiveStudentName: 'Tran Con',
      }
    });
    await prisma.opportunity.create({
      data: {
        leadId: leadConv.id,
        programId: startersProgram.id,
        status: OpportunityStatus.OPEN,
        value: 12000000,
        notes: 'Interest in Starters program after demo.'
      }
    });

    // Stage: TEST_DONE -> TRIAL_DONE
    const parentTrial = await prisma.parent.upsert({
      where: { phone: '0933444555' },
      update: {},
      create: { fullName: 'Le Van Trial', phone: '0933444555' }
    });
    const leadTrial = await prisma.lead.create({
      data: { parentId: parentTrial.id, centerId: center01.id, ownerId: sales01.id, status: LeadStatus.CONVERTED }
    });
    await prisma.opportunity.create({
      data: {
        leadId: leadTrial.id,
        programId: startersProgram.id,
        status: OpportunityStatus.TRIAL_DONE,
        value: 11500000,
        notes: 'Feedback good after trial session.'
      }
    });

    // Stage: WON (Student + Contract)
    const parentWon = await prisma.parent.upsert({
      where: { phone: '0988000999' },
      update: {},
      create: { fullName: 'Vu Hoang Won', phone: '0988000999' }
    });
    const leadWon = await prisma.lead.create({
      data: { parentId: parentWon.id, centerId: center01.id, ownerId: sales01.id, status: LeadStatus.CONVERTED }
    });
    const oppWon = await prisma.opportunity.create({
      data: { leadId: leadWon.id, programId: startersProgram.id, status: OpportunityStatus.WON, value: 12000000 }
    });
    // Create Student & Contract for the WON opportunity
    const studentWon = await prisma.student.create({
      data: {
        fullName: 'Vu Hoang Be',
        code: 'HV-PH5-001',
        centerId: center01.id,
        status: StudentStatus.ACTIVE,
        relations: { create: { parentId: parentWon.id, relationship: 'Father', isPrimaryContact: true, isPrimaryPayer: true } }
      }
    });
    await prisma.contract.create({
      data: {
        code: 'HD-PH5-001',
        studentId: studentWon.id,
        centerId: center01.id,
        ownerId: sales01.id,
        listPrice: 12000000,
        finalAmount: 11000000,
        status: ContractStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });

    // 8. Phase 6 Sample Data: Families & Multi-center students
    console.log('Generating Phase 6 Family & Student samples...');

    // Family 01: 1 Parent, 2 Kids, 2 Centers
    const parentFamily = await prisma.parent.upsert({
      where: { phone: '0977888999' },
      update: {},
      create: { 
        fullName: 'Nguyen Thi Gia Dinh', 
        phone: '0977888999', 
        email: 'giadinh@example.com',
        preferredCommunicationChannel: 'ZALO'
      }
    });

    const family01 = await prisma.family.upsert({
      where: { code: 'FAM-666888' },
      update: {},
      create: { code: 'FAM-666888', name: 'Nguyen Family' }
    });

    // Kid 1: CN01
    const kid01 = await prisma.student.upsert({
      where: { code: 'HV-P6-K1' },
      update: {},
      create: {
        fullName: 'Nguyen Anh',
        code: 'HV-P6-K1',
        centerId: center01.id,
        status: StudentStatus.ACTIVE,
        target: 'Cambridge Movers',
        relations: { 
          create: { 
            parentId: parentFamily.id, 
            familyId: family01.id,
            relationship: 'Mother', 
            isPrimaryContact: true, 
            isPrimaryPayer: true 
          } 
        }
      }
    });

    // Kid 2: CN02
    const kid02 = await prisma.student.upsert({
      where: { code: 'HV-P6-K2' },
      update: {},
      create: {
        fullName: 'Nguyen Binh',
        code: 'HV-P6-K2',
        centerId: center02.id,
        status: StudentStatus.ACTIVE,
        target: 'Beginner 1',
        relations: { 
          create: { 
            parentId: parentFamily.id, 
            familyId: family01.id,
            relationship: 'Mother', 
            isPrimaryContact: true, 
            isPrimaryPayer: true 
          } 
        }
      }
    });

    // Commercial data for Kid 1 (CN01) - Valid
    const contractK1 = await prisma.contract.create({
      data: {
        code: 'HD-P6-K1',
        studentId: kid01.id,
        centerId: center01.id,
        ownerId: sales01.id,
        listPrice: 10000000,
        finalAmount: 10000000,
        status: ContractStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });
    await prisma.payment.create({
      data: {
        contractId: contractK1.id,
        centerId: center01.id,
        amount: 4000000,
        status: 'COMPLETED'
      }
    });

    // Commercial data for Kid 2 (CN02) - Mixed
    const contractK2_Active = await prisma.contract.create({
      data: {
        code: 'HD-P6-K2-A',
        studentId: kid02.id,
        centerId: center02.id,
        ownerId: sales01.id,
        listPrice: 15000000,
        finalAmount: 15000000,
        status: ContractStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      }
    });
    // Valid payment
    await prisma.payment.create({
      data: {
        contractId: contractK2_Active.id,
        centerId: center02.id,
        amount: 5000000,
        status: 'COMPLETED'
      }
    });
    // Invalid payment (Voided)
    await prisma.payment.create({
      data: {
        contractId: contractK2_Active.id,
        centerId: center02.id,
        amount: 1000000,
        status: 'VOIDED'
      }
    });

    // Phase 4: Payment Schedules
    await prisma.paymentSchedule.createMany({
      data: [
        { contractId: contractK2_Active.id, dueDate: new Date(), amount: 5000000, paidAmount: 5000000, remainingAmount: 0, status: PaymentScheduleStatus.PAID },
        { contractId: contractK2_Active.id, dueDate: new Date(Date.now() + 30 * 86400000), amount: 5000000, paidAmount: 0, remainingAmount: 5000000, status: PaymentScheduleStatus.UNPAID },
        { contractId: contractK2_Active.id, dueDate: new Date(Date.now() - 30 * 86400000), amount: 5000000, paidAmount: 0, remainingAmount: 5000000, status: PaymentScheduleStatus.OVERDUE },
      ]
    });

    // Cancelled contract for Kid 2 (Should be excluded from balance)
    await prisma.contract.create({
      data: {
        code: 'HD-P6-K2-C',
        studentId: kid02.id,
        centerId: center02.id,
        ownerId: sales01.id,
        listPrice: 20000000,
        finalAmount: 20000000,
        status: ContractStatus.CANCELLED,
        startDate: new Date(),
        endDate: new Date(),
      }
    });

    console.log('✅ Phase 6 Seed completed successfully!');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
