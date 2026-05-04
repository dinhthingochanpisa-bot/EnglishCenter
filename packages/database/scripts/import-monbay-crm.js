const { execFileSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const workbookPath = process.argv[2] || 'E:\\EnglishCenter\\CRM Monbay.xlsx';
const RESET = process.argv.includes('--reset');
const CONFIG_ONLY = process.argv.includes('--config-only');
const DEFAULT_PASSWORD = 'password123';

const CRM_SHEETS = ['CRM Opportunity', 'Won data', 'Nature data', 'Fail'];
const STUDENT_SHEETS = ['DSHS chính thức', 'Lớp FT 470'];
const CONTRACT_SHEET = 'Bàn giao KT,XL';
const ACADEMIC_HANDOVER_SHEET = 'Bàn giao Academic';

const psScript = String.raw`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function ColIndex($ref) {
  $letters=($ref -replace '[0-9]','')
  $n=0
  foreach($ch in $letters.ToCharArray()) { $n=$n*26 + ([int][char]$ch - [int][char]'A' + 1) }
  return $n
}
function CellValue($c,$shared) {
  if($c.t -eq 's') { return $shared[[int]$c.v] }
  if($c.t -eq 'inlineStr') { return $c.is.t }
  return [string]$c.v
}
$zip=[System.IO.Compression.ZipFile]::OpenRead($env:MONBAY_XLSX)
try {
  $shared=@()
  $ssEntry=$zip.GetEntry('xl/sharedStrings.xml')
  if($ssEntry) {
    [xml]$ss=(New-Object IO.StreamReader($ssEntry.Open())).ReadToEnd()
    foreach($si in $ss.sst.si) {
      $texts=@()
      foreach($node in $si.ChildNodes) {
        if($node.Name -eq 't') { $texts += $node.InnerText }
        elseif($node.Name -eq 'r') { $texts += $node.t }
      }
      $shared += ($texts -join '')
    }
  }
  [xml]$wb=(New-Object IO.StreamReader($zip.GetEntry('xl/workbook.xml').Open())).ReadToEnd()
  [xml]$rels=(New-Object IO.StreamReader($zip.GetEntry('xl/_rels/workbook.xml.rels').Open())).ReadToEnd()
  $relMap=@{}
  foreach($rel in $rels.Relationships.Relationship) { $relMap[$rel.Id]=$rel.Target }
  $wanted=@('CRM Opportunity','Won data','Nature data','Fail','Bàn giao KT,XL','Bàn giao Academic','DSHS chính thức','Lớp FT 470','CONFIG')
  $result=@{}
  foreach($sheet in $wb.workbook.sheets.sheet) {
    if($wanted -notcontains $sheet.name) { continue }
    $rid=$sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $target='xl/'+$relMap[$rid]
    [xml]$ws=(New-Object IO.StreamReader($zip.GetEntry($target).Open())).ReadToEnd()
    $headerRow = if($sheet.name -eq 'CRM Opportunity' -or $sheet.name -eq 'DSHS chính thức' -or $sheet.name -eq 'Lớp FT 470') { 2 } else { 1 }
    $headers=@{}
    $headerNames=@{}
    $rows=@()
    foreach($row in $ws.worksheet.sheetData.row) {
      $vals=@{}
      foreach($c in $row.c) { $vals[(ColIndex $c.r)] = (CellValue $c $shared) }
      if([int]$row.r -eq $headerRow) {
        foreach($key in ($vals.Keys | Sort-Object {[int]$_})) {
          $name=([string]$vals[$key]).Trim()
          if($name) {
            $uniqueName=$name
            if($headerNames.ContainsKey($name)) { $uniqueName=$name + '__' + $key }
            $headerNames[$name]=$true
            $headers[$key]=$uniqueName
          }
        }
      } elseif([int]$row.r -gt $headerRow) {
        $obj=[ordered]@{}
        foreach($key in $headers.Keys) {
          $value=$vals[$key]
          if($null -ne $value) { $value=([string]$value).Trim() }
          $obj[$headers[$key]]=$value
        }
        $nonEmpty=($obj.Values | Where-Object { $_ -ne $null -and $_ -ne '' } | Measure-Object).Count
        if($nonEmpty -gt 0) { $rows += [pscustomobject]$obj }
      }
    }
    $result[$sheet.name]=$rows
  }
  $result | ConvertTo-Json -Depth 6 -Compress
} finally {
  $zip.Dispose()
}
`;

function readWorkbook() {
  const env = { ...process.env, MONBAY_XLSX: workbookPath };
  const output = execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
    { env, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 },
  );
  return JSON.parse(output);
}

function text(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function bool(value) {
  const valueText = text(value);
  if (!valueText) return null;
  return ['1', 'true', 'yes', 'x', 'có', 'done'].includes(valueText.toLowerCase());
}

function num(value) {
  const valueText = text(value);
  if (!valueText) return null;
  const normalized = valueText.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function excelDate(value) {
  const n = num(value);
  if (n !== null && n > 20000 && n < 70000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + n * 86400000);
  }
  const valueText = text(value);
  if (!valueText) return null;
  const parsed = new Date(valueText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function phone(value) {
  const valueText = text(value);
  if (!valueText) return null;
  const digits = valueText.replace(/[^\d+]/g, '');
  if (!digits) return null;
  return digits.startsWith('84') && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
}

function codePart(value) {
  return (text(value) || 'NA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .toUpperCase() || 'NA';
}

function uniqueValues(rows, key) {
  return [...new Set((rows || []).map((row) => text(row[key])).filter(Boolean))];
}

function parsePercent(value) {
  const valueText = text(value);
  if (!valueText) return null;
  const normalized = valueText.replace(',', '.').replace('%', '').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return valueText.includes('%') ? parsed / 100 : parsed;
}

function sessionCountFromPackage(value) {
  const valueText = text(value);
  if (!valueText) return null;
  const match = valueText.match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function upsertSystemConfig(prisma, key, value) {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

function statusFromSheet(sheetName) {
  if (sheetName === 'Won data') return { lead: 'CONVERTED', opportunity: 'WON', close: 'Won' };
  if (sheetName === 'Fail') return { lead: 'LOST', opportunity: 'LOST', close: 'Fail' };
  if (sheetName === 'Nature data') return { lead: 'NURTURING', opportunity: 'OPEN', close: 'Nature' };
  return { lead: 'NEW', opportunity: 'OPEN', close: null };
}

async function resetBusinessData(prisma) {
  await prisma.auditLog.deleteMany();
  await prisma.customerIssue.deleteMany();
  await prisma.warrantyCase.deleteMany();
  await prisma.studentExamEvent.deleteMany();
  await prisma.studentCareEvent.deleteMany();
  await prisma.progressNote.deleteMany();
  await prisma.academicResult.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentSchedule.deleteMany();
  await prisma.renewal.deleteMany();
  await prisma.contractDetail.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.salesHandover.deleteMany();
  await prisma.task.deleteMany();
  await prisma.interactionLog.deleteMany();
  await prisma.trialEvent.deleteMany();
  await prisma.testEvent.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.parentStudentRelation.deleteMany();
  await prisma.student.deleteMany();
  await prisma.family.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.classSchedule.deleteMany();
  await prisma.class.deleteMany();
  await prisma.level.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.program.deleteMany();
  await prisma.product.deleteMany();
  await prisma.leadSource.deleteMany();
}

async function ensureCenter(prisma, centerName, cache) {
  const name = text(centerName) || 'Monbay';
  const code = codePart(name).slice(0, 12);
  if (cache?.centersByName?.has(name.toLowerCase())) {
    return cache.centersByName.get(name.toLowerCase());
  }
  const center = await prisma.center.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
  cache?.centersByName?.set(name.toLowerCase(), center);
  cache?.centersByCode?.set(center.code, center);
  return center;
}

async function ensureUser(prisma, ownerCode, centerId, cache) {
  const code = text(ownerCode) || 'monbay-import';
  if (cache.users.has(code)) return cache.users.get(code);
  const role = await prisma.role.findFirst({ where: { code: { in: ['SALES', 'SUPER_ADMIN'] } } });
  if (!role) throw new Error('Missing SALES/SUPER_ADMIN role. Run seed before import.');
  const email = `${code.toLowerCase()}@monbay.local`;
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { fullName: code, roleId: role.id, isActive: true },
    create: { email, fullName: code, roleId: role.id, password, isActive: true },
  });
  await prisma.userCenter.createMany({
    data: [{ userId: user.id, centerId }],
    skipDuplicates: true,
  });
  cache.users.set(code, user);
  return user;
}

async function ensureProgram(prisma, productName, cache) {
  const name = text(productName) || 'General English';
  if (cache.programs.has(name)) return cache.programs.get(name);
  const product =
    (await prisma.product.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })) ||
    (await prisma.product.create({ data: { name, description: `Imported from CRM Monbay: ${name}` } }));
  const program = await prisma.program.upsert({
    where: { code: codePart(name) },
    update: { name, productId: product.id },
    create: { productId: product.id, name, code: codePart(name) },
  });
  const defaultPlan = await prisma.plan.findFirst({
    where: { programId: program.id, name: `${name} default` },
  });
  if (!defaultPlan) {
    await prisma.plan.create({
      data: { programId: program.id, name: `${name} default`, price: 0, durationMonths: 1 },
    });
  }
  cache.programs.set(name, program);
  return program;
}

async function ensureParent(prisma, row) {
  const mainPhone = phone(row['SĐT chính']) || phone(row['SĐT mẹ']) || phone(row['SĐT bố']) || phone(row['Lead Phone']) || phone(row['SĐT học sinh']);
  const motherPhone = phone(row['SĐT mẹ']);
  const fatherPhone = phone(row['SĐT bố']);
  const fullName =
    (mainPhone && mainPhone === motherPhone ? text(row['Họ tên mẹ']) : null) ||
    (mainPhone && mainPhone === fatherPhone ? text(row['Họ tên bố']) : null) ||
    text(row['Họ tên mẹ']) ||
    text(row['Họ tên bố']) ||
    text(row['Họ tên học sinh']) ||
    text(row['Họ tên học viên']) ||
    'Chưa rõ phụ huynh';
  const safePhone = mainPhone || `NO-PHONE-${codePart(fullName)}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return prisma.parent.upsert({
    where: { phone: safePhone },
    update: { fullName, address: text(row['Địa chỉ']) || undefined },
    create: { fullName, phone: safePhone, address: text(row['Địa chỉ']) },
  });
}

async function createLeadFromRow(prisma, row, sheetName, cache) {
  const center = await ensureCenter(prisma, row['Cơ sở'], cache);
  const owner = await ensureUser(prisma, row.Owner || row.TVV, center.id, cache);
  const sourceName = text(row['Nguồn lead']);
  const source = sourceName
    ? await prisma.leadSource.upsert({
        where: { name: sourceName },
        update: {},
        create: { name: sourceName },
      })
    : null;
  const parent = await ensureParent(prisma, row);
  const state = statusFromSheet(sheetName);
  const program = await ensureProgram(prisma, row['Sản phẩm'], cache);
  const lead = await prisma.lead.create({
    data: {
      parentId: parent.id,
      ownerId: owner.id,
      centerId: center.id,
      sourceId: source?.id,
      status: state.lead,
      externalOpportunityId: text(row.OppID) || text(row['Opp ID']),
      externalParentId: text(row.ParentID),
      externalStudentId: text(row.StudentID),
      productInterest: text(row['Sản phẩm']),
      leadPhone: phone(row['Lead Phone']),
      campaign: sourceName,
      contacted: bool(row.Contacted),
      contactedAt: excelDate(row['Contacted Date']),
      qualified: bool(row.Qualified),
      demand: text(row['Nhu cầu']),
      testAppointmentAt: excelDate(row['Ngày hẹn test']),
      checkedIn: bool(row['Check-in']),
      checkedInAt: excelDate(row['Ngày check-in']),
      prospectiveStudentName: text(row['Họ tên học sinh']),
      studentBirthday: excelDate(row['Ngày sinh']),
      grade: text(row['Lớp']),
      school: text(row['Trường']),
      target: text(row.Aim),
      aim: text(row.Aim),
      expectedExamTime: text(row['Thời gian thi dự kiến (HS)']),
      fatherName: text(row['Họ tên bố']),
      fatherPhone: phone(row['SĐT bố']),
      motherName: text(row['Họ tên mẹ']),
      motherPhone: phone(row['SĐT mẹ']),
      studentPhone: phone(row['SĐT học sinh']) || phone(row['SĐT chính']),
      address: text(row['Địa chỉ']),
      testDone: bool(row['Test Done']),
      testDate: excelDate(row['Test Date']),
      baseTaskCreated: bool(row['Tạo task (Base)']),
      headReturnedScore: bool(row['Head trả điểm']),
      scoreListening: num(row.L),
      scoreReading: num(row.R),
      scoreWriting: num(row.W),
      scoreSpeaking: num(row.S),
      scoreOverall: num(row.Overall),
      scoreReportUrl: text(row['Link phiếu điểm (PDF)']),
      resultReturned: bool(row['Đã trả kết quả']),
      resultReturnedAt: excelDate(row['Ngày trả kết quả']),
      closeStatus: state.close,
      sourceSheet: sheetName,
      notes: `Imported from CRM Monbay sheet ${sheetName}`,
    },
  });
  await prisma.opportunity.create({
    data: {
      leadId: lead.id,
      programId: program.id,
      status: state.opportunity,
      value: 0,
      notes: state.close ? `Close status: ${state.close}` : null,
    },
  });
  return lead;
}

function studentStatus(value) {
  const raw = (text(value) || '').toLowerCase();
  if (raw.includes('drop')) return 'DROPPED';
  if (raw.includes('bảo lưu') || raw.includes('hold')) return 'HOLD';
  if (raw.includes('refire') || raw.includes('active')) return 'ACTIVE';
  if (raw.includes('deposit')) return 'PENDING';
  return 'ACTIVE';
}

async function createStudentFromRow(prisma, row, sheetName, cache) {
  const name = text(row['Họ tên học viên']) || text(row['Họ tên học sinh']) || text(row['Họ tên HS']);
  if (!name) return null;
  const center = await ensureCenter(prisma, row['Cơ sở'], cache);
  const parent = await ensureParent(prisma, row);
  const code = text(row['ID học viên'])?.split(' - ')[0] || text(row.StudentID) || `HV-${codePart(name)}-${codePart(row['Ngày sinh'])}`;
  const student = await prisma.student.upsert({
    where: { code },
    update: {
      fullName: name,
      status: studentStatus(row.Status),
      centerId: center.id,
    },
    create: {
      code,
      fullName: name,
      status: studentStatus(row.Status),
      centerId: center.id,
      birthday: excelDate(row['Ngày sinh']),
      externalStudentId: text(row['ID học viên']) || text(row.StudentID),
      studentPhone: phone(row['SĐT học sinh']) || phone(row['SĐT chính']),
      school: text(row['Trường học']) || text(row['Trường']),
      currentGrade: text(row['Lớp']),
      address: text(row['Địa chỉ']),
      fatherName: text(row['Họ tên bố']),
      fatherPhone: phone(row['SĐT bố']),
      motherName: text(row['Họ tên mẹ']),
      motherPhone: phone(row['SĐT mẹ']),
      target: text(row.AIM) || text(row.Aim),
      aim: text(row.AIM) || text(row.Aim),
      universityTarget: text(row['Trường ĐH mm']),
      examBlock: text(row['Khối đk thi']),
      studyAbroad: bool(row['Du học']),
      siblingAtPisa: bool(row['Có ACE học PISA']),
      previousCenter: text(row['Đã học TT nào']),
      officialClassName: text(row['Lớp tại TT']),
      consultantCode: text(row.TVV),
      placementTestDate: excelDate(row['Ngày test đầu vào']),
      placementListening: num(row.L) || num(row.Listening),
      placementReading: num(row.R) || num(row.Reading),
      placementWriting: num(row.W) || num(row.W1) || num(row.Wri),
      placementWriting2: num(row.W2) || num(row['Wri 2']),
      placementGrammar: num(row.Grammar),
      placementSpeaking: num(row.S) || num(row.Speaking),
      placementOverall: num(row.Overall) || num(row['Điểm CK']),
      scoreReportUrl: text(row['Link phiếu điểm']) || text(row['Link phiếu điểm (PDF)']),
      examMonth: text(row['Thời gian thi']),
      detailedRoadmap: text(row['Lộ trình chi tiết']),
      careHistory: text(row['Lịch sử chăm sóc']),
      learningHistory: text(row['Lịch sử học tập']),
      paymentHistory: text(row['Lịch sử đóng phí']),
      productName: text(row['Sản phẩm']),
      productRank: text(row.Hạng),
      feePackage: text(row['Gói phí']),
      sourceSheet: sheetName,
    },
  });
  await prisma.parentStudentRelation.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    update: { relationship: 'Phụ huynh', isPrimaryContact: true, isPrimaryPayer: true },
    create: { parentId: parent.id, studentId: student.id, relationship: 'Phụ huynh', isPrimaryContact: true, isPrimaryPayer: true },
  });
  if (text(row['Lớp tại TT'])) {
    const program = await ensureProgram(prisma, row['Sản phẩm'] || 'General English', cache);
    const classCode = codePart(row['Lớp tại TT']);
    const cls = await prisma.class.upsert({
      where: { code: classCode },
      update: { name: text(row['Lớp tại TT']), centerId: center.id, programId: program.id },
      create: { code: classCode, name: text(row['Lớp tại TT']), centerId: center.id, programId: program.id, status: 'ACTIVE' },
    });
    await prisma.classStudent.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: student.id } },
      update: { status: 'ACTIVE' },
      create: { classId: cls.id, studentId: student.id, status: 'ACTIVE' },
    });
  }
  return student;
}

async function createContracts(prisma, rows, cache) {
  for (const row of rows || []) {
    const studentName = text(row['Họ tên học sinh']);
    const contractCode = text(row['SỐ HỢP ĐỒNG']);
    if (!studentName || !contractCode) continue;
    const center = await ensureCenter(prisma, row['Cơ sở'], cache);
    const owner = await ensureUser(prisma, row.TVV, center.id, cache);
    const student =
      (await prisma.student.findFirst({ where: { fullName: { equals: studentName, mode: 'insensitive' } } })) ||
      (await createStudentFromRow(prisma, row, CONTRACT_SHEET, cache));
    if (!student) continue;
    const listPrice = num(row['Học phí NY']) || num(row['Học phí thực đóng']) || 0;
    const paidAmount = num(row['Đã TT']) || 0;
    const finalAmount = num(row['Học phí thực đóng']) || listPrice || paidAmount || 0;
    const signedAt = excelDate(row['NGÀY KÍ']) || new Date();
    await prisma.contract.upsert({
      where: { code: contractCode },
      update: {},
      create: {
        code: contractCode,
        studentId: student.id,
        centerId: center.id,
        ownerId: owner.id,
        listPrice,
        discountPercent: num(row['CK %']) || 0,
        discountAmount: num(row['CK VND']) || 0,
        finalAmount,
        paidAmount,
        debtAmount: num(row['Công nợ HP']),
        debtDueDate: excelDate(row['Hạn chót thu công nợ']),
        status: 'ACTIVE',
        signedAt,
        startDate: signedAt,
        endDate: new Date(signedAt.getFullYear(), signedAt.getMonth() + 12, signedAt.getDate()),
        consultantCode: text(row.TVV),
        contractType: text(row['Loại HĐ']),
        productName: text(row['Sản phẩm']),
        productRank: text(row['Hạng SP']),
        feePackage: text(row['Gói phí']),
        contractedSessions: num(row['Số buổi đóng thực tế theo gói phí']),
        totalLearningSessions: num(row['Tổng số buổi cả LT']),
        mentorSessions: num(row['Tổng số buổi bổ trợ với Mentor']),
        tutorSessions: num(row['Tổng số buổi bổ trợ với Tutor']),
        mockTeacherSessions: num(row['Tổng số buổi Mock LRW+S GVTT theo gói phí']),
        mockExpertSessions: num(row['Tổng số buổi Mock S CG theo gói phí']),
        sourceSheet: CONTRACT_SHEET,
      },
    });
  }
}

async function ensureConfigCenter(prisma, code, name, cache) {
  const centerCode = codePart(code).slice(0, 12);
  const centerName = text(name) || centerCode;
  if (!centerCode || centerCode === 'NA' || !centerName) return null;

  const existing = await prisma.center.findFirst({
    where: {
      OR: [
        { code: centerCode },
        { name: { equals: centerName, mode: 'insensitive' } },
      ],
    },
  });

  const center = existing
    ? await prisma.center.update({
        where: { id: existing.id },
        data: { code: centerCode, name: centerName },
      })
    : await prisma.center.create({
        data: { code: centerCode, name: centerName },
      });

  cache.centersByCode.set(center.code, center);
  cache.centersByName.set(center.name.toLowerCase(), center);
  return center;
}

async function ensureConfigUser(prisma, staff, cache, passwordHash) {
  const nameCode = text(staff.nameCode);
  if (!nameCode) return null;
  const fullName = text(staff.name) || nameCode;
  const configRole = text(staff.role) || 'TVV';
  const mappedRoleCode = configRole === 'Branch CEO' || configRole === 'Leader' ? 'MANAGER' : 'SALES';
  const role = await prisma.role.findFirst({
    where: { code: mappedRoleCode },
    select: { id: true },
  });
  if (!role) return null;

  const email = `${nameCode.toLowerCase()}@monbay.local`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      roleId: role.id,
      isActive: true,
    },
    create: {
      email,
      fullName,
      roleId: role.id,
      password: passwordHash,
      isActive: true,
    },
  });

  const center =
    cache.centersByName.get((text(staff.branch) || '').toLowerCase()) ||
    cache.centersByName.get('monbay') ||
    cache.centersByCode.get('MB');
  if (center) {
    await prisma.userCenter.createMany({
      data: [{ userId: user.id, centerId: center.id }],
      skipDuplicates: true,
    });
  }
  cache.users.set(nameCode, user);
  return user;
}

async function upsertPlanFromPricing(prisma, row, cache) {
  const productName = text(row['Sản phẩm']);
  const rank = text(row['Hạng']);
  const feePackage = text(row['Gói phí']);
  const unitPrice = num(row['Đơn giá/buổi']);
  if (!productName || !rank || !feePackage || unitPrice === null) return null;

  const program = await ensureProgram(prisma, productName, cache);
  const planName = `${rank} - ${feePackage}`;
  const existing = await prisma.plan.findFirst({
    where: { programId: program.id, name: planName },
  });
  const data = {
    programId: program.id,
    name: planName,
    price: unitPrice,
    durationMonths: 1,
    sessionCount: sessionCountFromPackage(feePackage),
  };
  return existing
    ? prisma.plan.update({ where: { id: existing.id }, data })
    : prisma.plan.create({ data });
}

async function importConfig(prisma, rows, cache) {
  const configRows = rows || [];
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const branches = new Map();
  for (const row of configRows) {
    const code = text(row.CODE);
    const name = text(row.BRANCH);
    if (code && name && !branches.has(code)) {
      branches.set(code, { code, name });
    }
  }
  for (const branch of branches.values()) {
    await ensureConfigCenter(prisma, branch.code, branch.name, cache);
  }

  const staffByCode = new Map();
  for (const row of configRows) {
    const nameCode = text(row.NAMECODE);
    if (!nameCode || staffByCode.has(nameCode)) continue;
    staffByCode.set(nameCode, {
      nameCode,
      name: text(row.NAME),
      role: text(row.ROLE),
      branch: text(row.BRANCH__8) || text(row.BRANCH) || text(row['BRANCH THIS FILE']),
    });
  }
  for (const staff of staffByCode.values()) {
    await ensureConfigUser(prisma, staff, cache, passwordHash);
  }

  const fileBranch =
    cache.centersByName.get((uniqueValues(configRows, 'BRANCH THIS FILE')[0] || 'Monbay').toLowerCase()) ||
    cache.centersByCode.get(uniqueValues(configRows, 'CODE THIS FILE')[0] || 'MB') ||
    cache.centersByName.get('monbay');
  for (const ownerCode of uniqueValues(configRows, 'OWNER LIST')) {
    const staff = staffByCode.get(ownerCode) || {
      nameCode: ownerCode,
      name: ownerCode,
      role: 'TVV',
      branch: fileBranch?.name || 'Monbay',
    };
    await ensureConfigUser(prisma, staff, cache, passwordHash);
  }

  for (const sourceName of uniqueValues(configRows, 'LEAD_SOURCE')) {
    await prisma.leadSource.upsert({
      where: { name: sourceName },
      update: {},
      create: { name: sourceName },
    });
  }

  for (const productName of [
    ...uniqueValues(configRows, 'PRODUCT'),
    ...uniqueValues(configRows, 'Sản phẩm'),
  ]) {
    await ensureProgram(prisma, productName, cache);
  }

  const classCenter = fileBranch || cache.centersByName.get('monbay') || cache.centersByCode.get('MB');
  const classProgram = await ensureProgram(prisma, 'IELTS', cache);
  for (const className of uniqueValues(configRows, 'Lớp tại TT')) {
    if (!classCenter) continue;
    await prisma.class.upsert({
      where: { code: codePart(className) },
      update: {
        name: className,
        centerId: classCenter.id,
        programId: classProgram.id,
        status: 'ACTIVE',
      },
      create: {
        code: codePart(className),
        name: className,
        centerId: classCenter.id,
        programId: classProgram.id,
        status: 'ACTIVE',
      },
    });
  }

  const pricingMatrix = [];
  for (const row of configRows) {
    if (!text(row.PRICE_KEY) && !text(row['Sản phẩm'])) continue;
    const item = {
      product: text(row['Sản phẩm']),
      rank: text(row['Hạng']),
      feePackage: text(row['Gói phí']),
      unitPrice: num(row['Đơn giá/buổi']),
      discountPercent: text(row['CK%']),
      discountAmount: num(row['CK VND']),
      priceKey: text(row.PRICE_KEY),
    };
    if (item.product && item.rank && item.feePackage) {
      pricingMatrix.push(item);
      await upsertPlanFromPricing(prisma, row, cache);
    }
  }

  const discountSegments = configRows
    .map((row) => ({
      code: text(row.SEG_CODE),
      name: text(row.SEG_NAME),
      mode: text(row.MODE),
      percent: parsePercent(row.PCT),
      amount: num(row.VND),
      minSessions: num(row.MIN_BUOI),
    }))
    .filter((item) => item.code && item.name);

  const promotions = configRows
    .map((row) => ({
      code: text(row.PROMO_CODE),
      name: text(row.PROMO_NAME),
      mode: text(row.MODE__55),
      percent: parsePercent(row.PCT__56),
      amount: num(row.VND__57),
      active: bool(row.ACTIVE),
    }))
    .filter((item) => item.code && item.name);

  const monbayConfig = {
    branches: [...branches.values()],
    fileBranch: {
      code: uniqueValues(configRows, 'CODE THIS FILE')[0] || null,
      name: uniqueValues(configRows, 'BRANCH THIS FILE')[0] || null,
    },
    staff: [...staffByCode.values()],
    ownerCodes: uniqueValues(configRows, 'OWNER LIST'),
    schools: uniqueValues(configRows, 'Trường học'),
    grades: uniqueValues(configRows, 'Lớp'),
    centerClasses: uniqueValues(configRows, 'Lớp tại TT'),
    products: uniqueValues(configRows, 'PRODUCT'),
    contractTypes: uniqueValues(configRows, 'LOẠI HĐ'),
    leadSources: uniqueValues(configRows, 'LEAD_SOURCE'),
    lostReasons: uniqueValues(configRows, 'LOST_REASON'),
    closeStatuses: uniqueValues(configRows, 'CLOSE_STATUS'),
    scoreOptions: uniqueValues(configRows, 'SCORE'),
    officialStudentStatuses: uniqueValues(configRows, 'Status hs chính thức'),
    consultShifts: uniqueValues(configRows, 'CONSULT_SHIFT'),
    consultSlots: configRows
      .map((row) => ({ code: text(row.CA), time: text(row['GIỜ']) }))
      .filter((item) => item.code && item.time),
    targetBands: uniqueValues(configRows, 'TARGET_BAND'),
    examMonths: uniqueValues(configRows, 'EXAM_MONTH'),
    ranks: {
      ielts: uniqueValues(configRows, 'HẠNG_IELTS'),
      sat: uniqueValues(configRows, 'HẠNG_PHÍ_SAT'),
      junior: uniqueValues(configRows, 'HẠNG_JUNIOR'),
      all: uniqueValues(configRows, 'Hạng'),
    },
    feePackages: {
      ielts: uniqueValues(configRows, 'GÓI_PHÍ_IELTS'),
      sat: uniqueValues(configRows, 'GÓI_PHÍ_SAT'),
      junior: uniqueValues(configRows, 'GÓI_PHÍ_JUNIOR'),
      all: uniqueValues(configRows, 'Gói phí'),
    },
    pricingMatrix,
    discountSegments,
    promotions,
  };

  await upsertSystemConfig(prisma, 'MONBAY_CRM_CONFIG', monbayConfig);
  await upsertSystemConfig(prisma, 'MONBAY_CRM_PRICING', pricingMatrix);
  await upsertSystemConfig(prisma, 'MONBAY_CRM_DISCOUNT_SEGMENTS', discountSegments);
  await upsertSystemConfig(prisma, 'MONBAY_CRM_PROMOTIONS', promotions);

  return {
    branches: branches.size,
    staff: staffByCode.size,
    ownerCodes: monbayConfig.ownerCodes.length,
    schools: monbayConfig.schools.length,
    classes: monbayConfig.centerClasses.length,
    leadSources: monbayConfig.leadSources.length,
    pricingRows: pricingMatrix.length,
    discountSegments: discountSegments.length,
    promotions: promotions.length,
  };
}

async function main() {
  const workbook = readWorkbook();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const cache = {
    users: new Map(),
    programs: new Map(),
    centersByCode: new Map(),
    centersByName: new Map(),
  };
  try {
    if (RESET) await resetBusinessData(prisma);
    const configSummary = await importConfig(prisma, workbook.CONFIG || [], cache);

    if (CONFIG_ONLY) {
      console.log(JSON.stringify({ config: configSummary }, null, 2));
      return;
    }

    let leadCount = 0;
    for (const sheetName of CRM_SHEETS) {
      for (const row of workbook[sheetName] || []) {
        if (!text(row['Họ tên học sinh']) && !text(row.StudentID)) continue;
        await createLeadFromRow(prisma, row, sheetName, cache);
        leadCount += 1;
      }
    }

    let studentCount = 0;
    for (const sheetName of STUDENT_SHEETS) {
      for (const row of workbook[sheetName] || []) {
        const created = await createStudentFromRow(prisma, row, sheetName, cache);
        if (created) studentCount += 1;
      }
    }
    for (const row of workbook[ACADEMIC_HANDOVER_SHEET] || []) {
      const created = await createStudentFromRow(prisma, row, ACADEMIC_HANDOVER_SHEET, cache);
      if (created) studentCount += 1;
    }
    await createContracts(prisma, workbook[CONTRACT_SHEET] || [], cache);

    const [parents, students, leads, opportunities, contracts] = await Promise.all([
      prisma.parent.count(),
      prisma.student.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
      prisma.contract.count(),
    ]);
    console.log(JSON.stringify({ config: configSummary, importedRows: { leads: leadCount, students: studentCount }, totals: { parents, students, leads, opportunities, contracts } }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
