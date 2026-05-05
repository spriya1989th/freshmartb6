import { Controller, Post, Get, Body, UseGuards, HttpCode, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard, Public, CurrentUser } from '../../common/guards/jwt.guard';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { username: string; password: string }, @Request() req: any) {
    return this.auth.login(body.username, body.password, req.ip);
  }

  @Get('me')
  me(@CurrentUser() user: any) { return user; }

  @Post('change-password')
  changePassword(@Body() body: { currentPassword: string; newPassword: string }, @CurrentUser() user: any) {
    return this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
  }
}
