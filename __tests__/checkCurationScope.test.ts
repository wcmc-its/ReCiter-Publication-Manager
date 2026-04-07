import type { NextApiRequest } from 'next';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

jest.mock('../src/db/sequelize', () => ({
  __esModule: true,
  default: {
    Person: { findOne: jest.fn() },
    PersonPersonType: { findAll: jest.fn() },
  },
}));

import { getToken } from 'next-auth/jwt';
import models from '../src/db/sequelize';
import { checkCurationScope } from '../src/utils/checkCurationScope';

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockPersonFindOne = (models as any).Person.findOne as jest.MockedFunction<any>;
const mockPersonTypeFindAll = (models as any).PersonPersonType.findAll as jest.MockedFunction<any>;

const fakeReq = {} as NextApiRequest;

describe('checkCurationScope', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns {allowed: false, status: 401} when getToken returns null', async () => {
    mockGetToken.mockResolvedValue(null);

    const result = await checkCurationScope(fakeReq, 'uid123');
    expect(result).toEqual({ allowed: false, status: 401, message: 'Not authenticated' });
  });

  it('returns {allowed: true} when user has Superuser role (canCurate.all)', async () => {
    mockGetToken.mockResolvedValue({
      userRoles: JSON.stringify([{ roleLabel: 'Superuser', personIdentifier: 'su1' }]),
    } as any);

    const result = await checkCurationScope(fakeReq, 'anyUid');
    expect(result).toEqual({ allowed: true });
  });

  it('returns {allowed: true} when Curator_Self curates own personIdentifier', async () => {
    mockGetToken.mockResolvedValue({
      userRoles: JSON.stringify([{ roleLabel: 'Curator_Self', personIdentifier: 'self1' }]),
    } as any);

    const result = await checkCurationScope(fakeReq, 'self1');
    expect(result).toEqual({ allowed: true });
  });

  it('returns {allowed: true} when targetUid is in proxyPersonIds', async () => {
    mockGetToken.mockResolvedValue({
      userRoles: JSON.stringify([{ roleLabel: 'Curator_Self', personIdentifier: 'self1' }]),
      proxyPersonIds: JSON.stringify(['proxy1', 'proxy2']),
    } as any);

    const result = await checkCurationScope(fakeReq, 'proxy1');
    expect(result).toEqual({ allowed: true });
  });

  it('returns {allowed: false, status: 403} when scoped curator and person is out of scope', async () => {
    mockGetToken.mockResolvedValue({
      userRoles: JSON.stringify([{ roleLabel: 'Curator_Scoped', personIdentifier: 'scoped1' }]),
      scopeData: JSON.stringify({ personTypes: ['Faculty'], orgUnits: ['Cardiology'] }),
    } as any);

    mockPersonFindOne.mockResolvedValue({ primaryOrganizationalUnit: 'Neurology' });
    mockPersonTypeFindAll.mockResolvedValue([{ personType: 'Staff' }]);

    const result = await checkCurationScope(fakeReq, 'outOfScope1');
    expect(result).toEqual({
      allowed: false,
      status: 403,
      message: 'You do not have permission to curate this person',
    });
  });
});
