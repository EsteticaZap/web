import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, serverTimestamp } from '@angular/fire/firestore';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: any;
  updatedAt: any;
  onboardingCompleted?: boolean;
  configuracoes?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  
  // Signals para gerenciar estado de autenticação
  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);
  isLoading = signal<boolean>(true);
  userData = signal<UserData | null>(null);

  constructor() {
    // Observar mudanças no estado de autenticação
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser.set(user);
      this.isAuthenticated.set(!!user);
      this.isLoading.set(false);
      
      // Carregar dados do usuário do Firestore
      if (user) {
        await this.loadUserData(user.uid);
      } else {
        this.userData.set(null);
      }
    });
  }

  /**
   * Carregar dados do usuário do Firestore
   */
  private async loadUserData(uid: string): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        this.userData.set(userSnap.data() as UserData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  }

  /**
   * Recarregar dados do usuário do Firestore (público)
   */
  async refreshUserData(): Promise<void> {
    const user = this.currentUser();
    if (user) {
      await this.loadUserData(user.uid);
    }
  }

  /**
   * Salvar dados do usuário no Firestore
   */
  private async saveUserData(userData: UserData): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, 'users', userData.uid);
      await setDoc(userDocRef, {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Erro ao salvar dados do usuário no Firestore:', error);
      // Não impede o registro mesmo se falhar o salvamento no Firestore
      return false;
    }
  }

  /**
   * Login com email e senha
   */
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      if (result.user) {
        return { success: true };
      }
      return { success: false, error: 'Erro ao fazer login' };
    } catch (error: any) {
      console.error('Erro no login:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Registro de novo usuário com email, senha e nome
   */
  async register(email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      if (result.user) {
        // Atualizar o perfil do usuário com o nome
        try {
          await updateProfile(result.user, { displayName });
        } catch (profileError) {
          console.error('Erro ao atualizar perfil:', profileError);
        }
        
        // Criar documento do usuário no Firestore
        const userData: UserData = {
          uid: result.user.uid,
          email: result.user.email || email,
          displayName: displayName,
          createdAt: null,
          updatedAt: null
        };
        
        // Salvar no Firestore (não bloqueia se falhar)
        await this.saveUserData(userData);
        
        this.userData.set(userData);
        
        return { success: true };
      }
      return { success: false, error: 'Erro ao criar conta' };
    } catch (error: any) {
      console.error('Erro no registro:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Login com Google
   */
  async loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      
      if (result.user) {
        // Verificar se já existe documento do usuário
        try {
          const userDocRef = doc(this.firestore, 'users', result.user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
            // Criar documento se não existir
            const userData: UserData = {
              uid: result.user.uid,
              email: result.user.email || '',
              displayName: result.user.displayName || '',
              photoURL: result.user.photoURL || undefined,
              createdAt: null,
              updatedAt: null
            };
            
            await this.saveUserData(userData);
            this.userData.set(userData);
          }
        } catch (firestoreError) {
          console.error('Erro ao verificar/criar documento:', firestoreError);
        }
        
        return { success: true };
      }
      return { success: false, error: 'Erro ao fazer login com Google' };
    } catch (error: any) {
      console.error('Erro no login com Google:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Enviar email de recuperação de senha
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true };
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  /**
   * Logout do usuário
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.userData.set(null);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  /**
   * Traduzir códigos de erro do Firebase para mensagens em português
   */
  private getErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      'auth/user-not-found': 'Usuário não encontrado. Verifique o email digitado.',
      'auth/wrong-password': 'Senha incorreta. Tente novamente.',
      'auth/invalid-email': 'Email inválido. Verifique o formato.',
      'auth/email-already-in-use': 'Este email já está cadastrado.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
      'auth/popup-closed-by-user': 'Login cancelado pelo usuário.',
      'auth/invalid-credential': 'Credenciais inválidas. Verifique email e senha.',
      'auth/operation-not-allowed': 'Operação não permitida. Entre em contato com o suporte.'
    };

    return errorMessages[errorCode] || 'Erro ao processar sua solicitação. Tente novamente.';
  }
}
