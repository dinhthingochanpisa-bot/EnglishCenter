import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CenterScope } from '../common/utils/center-scope.utils';
import { LeadStatus, OpportunityStatus } from '@prisma/client';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  async getPipeline(user: any) {
    const where = CenterScope.filter(user);

    // Fetch Leads (stages 1-3)
    const leads = await this.prisma.lead.findMany({
      where: {
        ...where,
        status: {
          in: [LeadStatus.NEW, LeadStatus.CONTACTED],
        },
      },
      include: {
        parent: { select: { fullName: true, phone: true } },
        owner: { select: { fullName: true } },
      },
    });

    // Fetch Opportunities (stages 4-9)
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        lead: where,
      },
      include: {
        lead: {
          include: {
            parent: { select: { fullName: true, phone: true } },
            owner: { select: { fullName: true } },
          },
        },
        program: { select: { name: true } },
      },
    });

    // Structure for Kanban
    return {
      leads: leads.map((l) => ({
        id: l.id,
        entityType: 'LEAD',
        title: l.prospectiveStudentName || l.parent?.fullName || 'Unknown Lead',
        subtitle: l.parent?.phone || 'No phone',
        status: l.status,
        owner: l.owner?.fullName,
        centerId: l.centerId,
      })),
      opportunities: opportunities.map((o) => ({
        id: o.id,
        entityType: 'OPPORTUNITY',
        title: o.lead.prospectiveStudentName || o.lead.parent?.fullName || 'Unknown Lead',
        subtitle: o.program?.name || 'No program',
        status: o.status,
        owner: o.lead.owner?.fullName,
        centerId: o.lead.centerId,
        leadId: o.leadId,
      })),
    };
  }
}
