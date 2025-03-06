import { Injectable } from "@angular/core";
import { FirebaseService } from "./firebase.service";
import { catchError, forkJoin, from, Observable, of, Subscriber, switchMap } from "rxjs";
import { FIREBASE_ERROR_SERVICE } from "./firebase.enum";
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { IDocumentData } from "./firebase.interface";
import { instanceToPlain } from "class-transformer";
import { CreateDocumentModel, DeleteDocumentModel, UpdateDocumentModel } from "./firebase.model";

@Injectable({
  providedIn: 'root'
})
export class FirebaseCollectionService<T> {
  private _collection!: string;
  get collection(): string {
    return this._collection;
  }
  set collection(collection: string) {
    this._collection = collection;
  }

  constructor(protected firebaseService: FirebaseService) {}

  private isInstance(data: any): boolean {
    return data !== null && typeof data === 'object' && Object.getPrototypeOf(data) !== Object.prototype;
  }

  addNewDocument(data: CreateDocumentModel): Observable<IDocumentData> {
    return new Observable((subs: Subscriber<IDocumentData>) => {
      try {
        const checkValid = this.firebaseService.checkValidService(this.collection);
        if (checkValid.code && checkValid.code !== FIREBASE_ERROR_SERVICE.AUTH) {
          subs.error(checkValid);
          subs.complete();
        } else {
          const _ref = collection(this.firebaseService.store, this.collection);
          debugger
          from(addDoc(_ref, this.isInstance(data) ? CreateDocumentModel.toJson(data) : data))
          .pipe(
            catchError(error => {
              subs.error(error);
              subs.complete();

              return of(null);
            }),
            switchMap(resp => {
              return !resp ? of(null) : from(getDoc(resp));
            }),
          )
          .subscribe(newDoc => {
            if (newDoc?.exists()) {
              const newData = {
                ...newDoc.data(),
                firebaseId: newDoc.id,
              };
              subs.next(newData);
              subs.complete();
            }
          });
        }
      } catch (error) {
        subs.error(error);
        subs.complete();
      }
    });
  }

  updateDocument(firebaseID: string, data: UpdateDocumentModel): Observable<IDocumentData> {
    return new Observable((subs: Subscriber<IDocumentData>) => {
      try {
        const checkValid = this.firebaseService.checkValidService(this.collection);
        if (checkValid.code && checkValid.code !== FIREBASE_ERROR_SERVICE.AUTH) {
          subs.error(checkValid);
          subs.complete();
        } else {
          const _docRef = doc(this.firebaseService.store, this.collection, firebaseID);
          from(updateDoc(_docRef, {...data}))
          .pipe(
            catchError(error => {
              subs.error(error);
              subs.complete();
              return of(null);
            }),
            switchMap(resp => {
              return !resp ? of(null) : from(getDoc(_docRef));
            }),
          )
          .subscribe(resp => {
            if (resp?.exists()) {
              const newData = {
                ...resp.data(),
                firebaseId: resp.id,
              };
              subs.next(newData);
              subs.complete();
            }
          });
        }
      } catch (error) {
        subs.error(error);
        subs.complete();
      }
    });
  }

  deleteDocumentWithID(datas: Array<DeleteDocumentModel>): Observable<Array<Boolean>> {
    return new Observable<Array<Boolean>>((subs: Subscriber<Array<Boolean>>) => {
      try {
        const checkValid = this.firebaseService.checkValidService(this.collection);
        if (checkValid.code && checkValid.code !== FIREBASE_ERROR_SERVICE.AUTH) {
          subs.error(checkValid);
          subs.complete();
        } else {
          const _requests: Array<Observable<void>> = [];
          datas.forEach(item => {
            const _docRef = doc(this.firebaseService.store, this.collection, item.firebaseId);
            _requests.push(from(updateDoc(_docRef, {...item})));
          });

          forkJoin(_requests).subscribe({
            next: resp => {
              subs.next(resp.map(elm => typeof elm === 'function'));
              subs.complete();
            },
            error: error => {
              subs.error(error);
              subs.complete();
            },
          });
        }
      } catch (error) {
        subs.error(error);
        subs.complete();
      }
    });
  }
}
