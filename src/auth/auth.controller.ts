import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  accessCookieName,
  accessCookieOptions,
  clearAccessCookieOptions,
  clearRefreshCookieOptions,
  refreshCookieName,
  refreshCookieOptions,
} from './auth-cookie';
import { AccessTokenGuard } from './access-token.guard';
import { AuthRequest } from './auth-request';
import { Throttle } from '@nestjs/throttler';
import { UnauthorizedException } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
  ) {}

  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  getCsrfToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): { csrfToken: string } {
    return { csrfToken: this.csrf.issueToken(request, response) };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(body.email, body.password);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      csrfToken: this.csrf.issueToken(request, response, true),
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body.email, body.password);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      csrfToken: this.csrf.issueToken(request, response, true),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[refreshCookieName()];
    if (!refreshToken) {
      response.clearCookie(refreshCookieName(), clearRefreshCookieOptions());
      response.clearCookie(accessCookieName(), clearAccessCookieOptions());
      throw new UnauthorizedException('Refresh token required');
    }

    const result = await this.auth.refresh(refreshToken);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      csrfToken: this.csrf.issueToken(request, response, true),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[refreshCookieName()]);
    response.clearCookie(accessCookieName(), clearAccessCookieOptions());
    response.clearCookie(refreshCookieName(), clearRefreshCookieOptions());
    this.csrf.issueToken(request, response, true);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@Req() request: AuthRequest) {
    return { user: await this.auth.getCurrentUser(request.user.id) };
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(accessCookieName(), accessToken, accessCookieOptions());
    response.cookie(refreshCookieName(), refreshToken, refreshCookieOptions());
  }
}