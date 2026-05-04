import { Module } from '@nestjs/common';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { OpportunityService } from './opportunity.service';
import { OpportunityController } from './opportunity.controller';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { CommercialModule } from '../commercial/commercial.module';

@Module({
  imports: [CommercialModule],
  controllers: [LeadController, OpportunityController, CrmController],
  providers: [LeadService, OpportunityService, CrmService],
  exports: [LeadService, OpportunityService, CrmService],
})
export class LeadModule {}
