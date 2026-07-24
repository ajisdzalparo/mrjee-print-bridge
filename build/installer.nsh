!macro customInit
  # Auto-close any running instances when starting installer
  ExecWait 'cmd /c taskkill /F /IM "Mrjee Print Bridge Commercial.exe" /T'
!macroend

!macro customUnInit
  # Auto-close any running instances when starting uninstaller
  ExecWait 'cmd /c taskkill /F /IM "Mrjee Print Bridge Commercial.exe" /T'
!macroend

!macro customUnInstall
  # Only show prompt during interactive uninstallation (skip during silent update)
  IfSilent skipUninstallPrompt
  MessageBox MB_YESNO|MB_ICONQUESTION "Mrjee Print Bridge Commercial — Konfirmasi Uninstall:$\n$\nApakah Anda ingin menghapus seluruh data & konfigurasi printer yang tersimpan di komputer ini?$\n$\n• [Pilih YES] untuk menghapus semua data & mereset konfigurasi.$\n• [Pilih NO] untuk tetap menyimpan data konfigurasi printer agar dapat digunakan kembali." IDNO keepConfigData
    RMDir /r "$PROFILE\.print-bridge"
    RMDir /r "$APPDATA\mrjee-print-bridge-commercial"
    RMDir /r "$LOCALAPPDATA\mrjee-print-bridge-commercial"
    goto finishUninstall
  keepConfigData:
    # User chose to preserve data & configs
  finishUninstall:
  skipUninstallPrompt:
!macroend
