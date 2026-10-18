import { Catch, ArgumentsHost, HttpException, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost): Observable<any> {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as any).message || exception.message;

      return throwError(
        () => new RpcException({ status, message }),
      );
    }

    return throwError(
      () => new RpcException({
        status: 500,
        message: 'Internal server error',
      }),
    );
  }
}
