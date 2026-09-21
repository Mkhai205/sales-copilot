import { ConfigService } from '@nestjs/config';
import { ResendService } from '../resend.service';

describe('ResendService', () => {
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any;
  });

  describe('sendEmployeeCredentials in simulated mode', () => {
    it('renders the React email template and returns true when RESEND_API_KEY is missing', async () => {
      configService.get.mockReturnValue(undefined);
      const service = new ResendService(configService);

      const result = await service.sendEmployeeCredentials({
        to: 'staff@example.com',
        name: 'Nguyen Van B',
        temporaryPassword: 'TempPassword123!',
        workspaceName: 'Shop Thoi Trang',
        role: 'AGENT',
        loginUrl: 'http://localhost:3000/login',
      });

      expect(result).toBe(true);
    });
  });

  describe('sendEmployeeCredentials with Resend API', () => {
    it('renders template and dispatches email via Resend SDK', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_test_123456';
        if (key === 'RESEND_FROM_EMAIL') return 'Test Copilot <test@salescopilot.io>';
        return undefined;
      });

      const service = new ResendService(configService);

      // Mock internal resend.emails.send
      const mockSend = jest.fn().mockResolvedValue({
        data: { id: 'email_test_abc123' },
        error: null,
      });
      (service as any).resend = {
        emails: {
          send: mockSend,
        },
      };

      const result = await service.sendEmployeeCredentials({
        to: 'staff@example.com',
        name: 'Nguyen Van B',
        temporaryPassword: 'TempPassword123!',
        workspaceName: 'Shop Thoi Trang',
        role: 'ADMIN',
        loginUrl: 'http://localhost:3000/login',
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const sendArgs = mockSend.mock.calls[0][0];
      expect(sendArgs.to).toBe('staff@example.com');
      expect(sendArgs.from).toBe('Test Copilot <test@salescopilot.io>');
      expect(sendArgs.subject).toBe(
        '[Sales Copilot] Thông tin tài khoản nhân viên - Shop Thoi Trang',
      );

      // Verify that the rendered HTML contains all required elements from React Email
      expect(sendArgs.html).toContain('Nguyen Van B');
      expect(sendArgs.html).toContain('TempPassword123!');
      expect(sendArgs.html).toContain('Shop Thoi Trang');
      expect(sendArgs.html).toContain('Quản trị viên (Admin)');
      expect(sendArgs.html).toContain('Sales Copilot');
      expect(sendArgs.html).toContain('http://localhost:3000/login');
    });

    it('returns false when Resend returns an error response', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'RESEND_API_KEY') return 're_test_123456';
        return undefined;
      });

      const service = new ResendService(configService);

      const mockSend = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Domain not verified' },
      });
      (service as any).resend = {
        emails: {
          send: mockSend,
        },
      };

      const result = await service.sendEmployeeCredentials({
        to: 'staff@example.com',
        name: 'Nguyen Van B',
        temporaryPassword: 'TempPassword123!',
        workspaceName: 'Shop Thoi Trang',
        role: 'AGENT',
      });

      expect(result).toBe(false);
    });
  });
});
