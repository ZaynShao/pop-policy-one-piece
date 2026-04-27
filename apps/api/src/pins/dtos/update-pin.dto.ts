import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 不允许改 provinceCode / cityName —— 改了会动 lng/lat 影响散点位置
 * 状态机校验在 service.update 里(prev → next 合法性 + aborted_reason 必填校验等)
 */
export class UpdatePinDto {
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsEnum(['in_progress', 'completed', 'aborted'])
  status?: 'in_progress' | 'completed' | 'aborted';
  @IsOptional() @IsString() abortedReason?: string | null;
  @IsOptional() @IsEnum(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';
}
