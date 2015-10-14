import { Subject, Observable, Subscriber, Subscription } from '@reactivex/rxjs';

export interface Observer<T> {
  next: (value: T) => void;
  error: (error: any) => void;
  complete: () => void;
  isUnsubscribed?: boolean;
}

export class RxWebSocket {
  socket: WebSocket;
  messageQueue: string[] = [];

  constructor(private url: string, private WebSocketCtor: { new(url:string): WebSocket } = WebSocket) {
  }

  static create(url:string, WebSocketCtor: { new(url:string): WebSocket } = WebSocket): RxWebSocket {
    return new RxWebSocket(url, WebSocketCtor);
  }

  _out: Observable<MessageEvent>;
  _in: Observer<string>;

  get out(): Observable<MessageEvent> {
    if(!this._out) {
      this._out = Observable.create(subscriber => {
        let socket = this.socket = new this.WebSocketCtor(this.url);

        socket.onopen = () => {
          this.flushMessages();
        };

        socket.onclose = (e) => {
          if(e.wasClean) {
            subscriber.complete();
          } else {
            subscriber.error(e);
          }
        };

        socket.onerror = (e) => subscriber.error(e);

        return () => {
          socket.close();
          this.socket = null;
        };
      }).share();
    }

    return this._out;
  }

  get in(): Observer<string> {
    if(!this._in) {
      this._in = {
        next(message: string) {
          if(!this.socket) {
            this.messageQueue.push(message);
          } else {
            this.socket.send(message);
          }
        },
        error(err: any) {
          this.socket.close(3000, err);
          this.socket = null;
        },
        complete() {
          this.socket.close();
          this.socket = null;
        }
      }
    }
    return this._in;
  }

  private flushMessages() {
    const messageQueue = this.messageQueue;
    const socket = this.socket;

    while(messageQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
      socket.send(messageQueue.shift());
    }
  }
}