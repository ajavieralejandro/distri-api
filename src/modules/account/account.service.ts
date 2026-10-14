import { HttpStatus, Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import {
  CommercesService,
  type CommerceView,
} from '../commerces/commerces.service';

export type AccountView = {
  balanceAvailable: false;
  commerce: CommerceView;
  movements: [];
};

@Injectable()
export class AccountService {
  constructor(private readonly commercesService: CommercesService) {}

  async getMine(user: AuthenticatedUser): Promise<AccountView> {
    if (user.role !== 'COMMERCE' || !user.commerceId) {
      throw new AppException(
        'El usuario no está vinculado a un comercio.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }
    const commerce = await this.commercesService.getById(user, user.commerceId);
    return {
      balanceAvailable: false,
      commerce,
      movements: [],
    };
  }
}
