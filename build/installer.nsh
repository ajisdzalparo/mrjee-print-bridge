!macro customInit
  # Auto-close any running instances when starting installer
  ExecWait 'cmd /c taskkill /F /IM "MJ Multiple Bridge Print.exe" /T'
!macroend

!macro customUnInit
  # Auto-close any running instances when starting uninstaller
  ExecWait 'cmd /c taskkill /F /IM "MJ Multiple Bridge Print.exe" /T'
!macroend

!macro customUnInstall
  # Only show prompt during interactive uninstallation (skip during silent update)
  IfSilent skipUninstallPrompt
  MessageBox MB_YESNO|MB_ICONQUESTION "MRJEE MJ Multiple Printer — Konfirmasi Uninstall:$\n$\nApakah Anda ingin menghapus seluruh data & konfigurasi printer yang tersimpan di komputer ini?$\n$\n• [Pilih YES] untuk menghapus semua data & mereset konfigurasi.$\n• [Pilih NO] untuk tetap menyimpan data konfigurasi printer agar dapat digunakan kembali." IDNO keepConfigData
    RMDir /r "$PROFILE\.print-bridge"
    RMDir /r "$APPDATA\mj-multiple-bridge-print"
    RMDir /r "$LOCALAPPDATA\mj-multiple-bridge-print"
    goto finishUninstall
  keepConfigData:
    # User chose to preserve data & configs
  finishUninstall:
  skipUninstallPrompt:
!macroend
