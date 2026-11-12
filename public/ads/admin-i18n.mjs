export const languages = [
  ["en", "English", "ltr"],
  ["ko", "한국어", "ltr"],
  ["zh-CN", "简体中文", "ltr"],
  ["zh-TW", "繁體中文", "ltr"],
  ["ja", "日本語", "ltr"],
  ["es", "Español", "ltr"],
  ["fr", "Français", "ltr"],
  ["de", "Deutsch", "ltr"],
  ["pt", "Português", "ltr"],
  ["ar", "العربية", "rtl"],
  ["hi", "हिन्दी", "ltr"],
  ["id", "Bahasa Indonesia", "ltr"]
];

const keys = [
  "title", "accounts", "credentials", "audit", "refresh",
  "search", "name", "status", "created", "actions",
  "pending", "active", "suspended", "revoked", "approve",
  "suspend", "reactivate", "issue", "rotate", "revoke",
  "close", "confirm", "cancel", "empty", "accessRequired",
  "connectionUnavailable", "loading", "saved", "failed",
  "oneTimeKey", "copy", "copied", "selectAccount",
  "noCredentials", "noAudit", "language"
];

const rows = {
  en: [
    "Advertising administration","Publishers","Access keys","Activity","Refresh",
    "Search publishers","Name","Status","Created","Actions",
    "Pending","Active","Suspended","Revoked","Approve",
    "Suspend","Reactivate","Issue key","Rotate key","Revoke key",
    "Close","Confirm this action?","Cancel","No records",
    "Administrator access required","Connection unavailable","Loading","Saved",
    "Request failed","Copy this key now. It cannot be viewed again.",
    "Copy","Copied","Select a publisher","No keys","No activity","Language"
  ],
  ko: [
    "광고 관리","매체사","인증키","활동 기록","새로고침",
    "매체사 검색","이름","상태","등록일","작업",
    "승인 대기","활성","정지","폐기","승인",
    "정지","재활성화","인증키 발급","인증키 교체","인증키 폐기",
    "닫기","이 작업을 진행하시겠습니까?","취소","기록 없음",
    "관리자 로그인이 필요합니다","연결할 수 없습니다","불러오는 중","저장됨",
    "요청에 실패했습니다","이 인증키는 다시 조회할 수 없습니다. 지금 복사하세요.",
    "복사","복사됨","매체사를 선택하세요","인증키 없음","활동 기록 없음","언어"
  ],
  "zh-CN": [
    "广告管理","媒体合作方","访问密钥","操作记录","刷新",
    "搜索媒体合作方","名称","状态","创建时间","操作",
    "待审核","有效","已暂停","已撤销","批准",
    "暂停","重新启用","签发密钥","轮换密钥","撤销密钥",
    "关闭","确认执行此操作？","取消","暂无记录",
    "需要管理员登录","连接不可用","加载中","已保存",
    "请求失败","此密钥无法再次查看，请立即复制。",
    "复制","已复制","请选择媒体合作方","暂无密钥","暂无操作记录","语言"
  ],
  "zh-TW": [
    "廣告管理","媒體合作夥伴","存取金鑰","操作紀錄","重新整理",
    "搜尋媒體合作夥伴","名稱","狀態","建立時間","操作",
    "待審核","有效","已暫停","已撤銷","核准",
    "暫停","重新啟用","核發金鑰","輪替金鑰","撤銷金鑰",
    "關閉","確定執行此操作？","取消","沒有紀錄",
    "需要管理員登入","無法連線","載入中","已儲存",
    "請求失敗","此金鑰無法再次查看，請立即複製。",
    "複製","已複製","請選擇媒體合作夥伴","沒有金鑰","沒有操作紀錄","語言"
  ],
  ja: [
    "広告管理","媒体社","認証キー","操作履歴","更新",
    "媒体社を検索","名前","状態","作成日","操作",
    "承認待ち","有効","停止中","失効","承認",
    "停止","再有効化","キーを発行","キーを更新","キーを失効",
    "閉じる","この操作を実行しますか？","キャンセル","記録なし",
    "管理者ログインが必要です","接続できません","読み込み中","保存しました",
    "リクエストに失敗しました","このキーは再表示できません。今すぐコピーしてください。",
    "コピー","コピーしました","媒体社を選択","キーなし","操作履歴なし","言語"
  ],
  es: [
    "Administración de anuncios","Editores","Claves de acceso","Actividad","Actualizar",
    "Buscar editores","Nombre","Estado","Creado","Acciones",
    "Pendiente","Activo","Suspendido","Revocado","Aprobar",
    "Suspender","Reactivar","Emitir clave","Rotar clave","Revocar clave",
    "Cerrar","¿Confirmar esta acción?","Cancelar","Sin registros",
    "Se requiere acceso de administrador","Conexión no disponible","Cargando","Guardado",
    "La solicitud falló","Copie esta clave ahora. No podrá verla de nuevo.",
    "Copiar","Copiado","Seleccione un editor","Sin claves","Sin actividad","Idioma"
  ],
  fr: [
    "Gestion publicitaire","Éditeurs","Clés d’accès","Activité","Actualiser",
    "Rechercher des éditeurs","Nom","Statut","Créé le","Actions",
    "En attente","Actif","Suspendu","Révoqué","Approuver",
    "Suspendre","Réactiver","Créer une clé","Renouveler la clé","Révoquer la clé",
    "Fermer","Confirmer cette action ?","Annuler","Aucun résultat",
    "Connexion administrateur requise","Connexion indisponible","Chargement","Enregistré",
    "Échec de la demande","Copiez cette clé maintenant. Elle ne sera plus affichée.",
    "Copier","Copié","Choisissez un éditeur","Aucune clé","Aucune activité","Langue"
  ],
  de: [
    "Anzeigenverwaltung","Publisher","Zugangsschlüssel","Aktivitäten","Aktualisieren",
    "Publisher suchen","Name","Status","Erstellt","Aktionen",
    "Ausstehend","Aktiv","Gesperrt","Widerrufen","Freigeben",
    "Sperren","Reaktivieren","Schlüssel ausstellen","Schlüssel wechseln","Schlüssel widerrufen",
    "Schließen","Aktion bestätigen?","Abbrechen","Keine Einträge",
    "Administratoranmeldung erforderlich","Verbindung nicht verfügbar","Wird geladen","Gespeichert",
    "Anfrage fehlgeschlagen","Schlüssel jetzt kopieren. Er wird nicht erneut angezeigt.",
    "Kopieren","Kopiert","Publisher auswählen","Keine Schlüssel","Keine Aktivitäten","Sprache"
  ],
  pt: [
    "Administração de anúncios","Veículos","Chaves de acesso","Atividade","Atualizar",
    "Pesquisar veículos","Nome","Status","Criado em","Ações",
    "Pendente","Ativo","Suspenso","Revogado","Aprovar",
    "Suspender","Reativar","Emitir chave","Trocar chave","Revogar chave",
    "Fechar","Confirmar esta ação?","Cancelar","Sem registros",
    "Acesso de administrador necessário","Conexão indisponível","Carregando","Salvo",
    "Falha na solicitação","Copie esta chave agora. Ela não poderá ser exibida novamente.",
    "Copiar","Copiado","Selecione um veículo","Sem chaves","Sem atividade","Idioma"
  ],
  ar: [
    "إدارة الإعلانات","الناشرون","مفاتيح الوصول","سجل النشاط","تحديث",
    "البحث عن ناشر","الاسم","الحالة","تاريخ الإنشاء","الإجراءات",
    "قيد المراجعة","نشط","موقوف","ملغى","موافقة",
    "إيقاف","إعادة التفعيل","إصدار مفتاح","تدوير المفتاح","إلغاء المفتاح",
    "إغلاق","هل تؤكد هذا الإجراء؟","إلغاء","لا توجد سجلات",
    "يلزم تسجيل دخول المسؤول","الاتصال غير متاح","جارٍ التحميل","تم الحفظ",
    "فشل الطلب","انسخ هذا المفتاح الآن. لن تتمكن من عرضه مرة أخرى.",
    "نسخ","تم النسخ","اختر ناشرًا","لا توجد مفاتيح","لا يوجد نشاط","اللغة"
  ],
  hi: [
    "विज्ञापन प्रबंधन","प्रकाशक","एक्सेस कुंजियाँ","गतिविधि","रीफ़्रेश",
    "प्रकाशक खोजें","नाम","स्थिति","बनाया गया","कार्रवाई",
    "लंबित","सक्रिय","निलंबित","निरस्त","स्वीकृत करें",
    "निलंबित करें","पुनः सक्रिय करें","कुंजी जारी करें","कुंजी बदलें","कुंजी निरस्त करें",
    "बंद करें","इस कार्रवाई की पुष्टि करें?","रद्द करें","कोई रिकॉर्ड नहीं",
    "व्यवस्थापक लॉगिन आवश्यक है","कनेक्शन उपलब्ध नहीं","लोड हो रहा है","सहेजा गया",
    "अनुरोध विफल रहा","इस कुंजी को अभी कॉपी करें। इसे फिर नहीं दिखाया जाएगा।",
    "कॉपी करें","कॉपी हो गया","प्रकाशक चुनें","कोई कुंजी नहीं","कोई गतिविधि नहीं","भाषा"
  ],
  id: [
    "Administrasi iklan","Penerbit","Kunci akses","Aktivitas","Muat ulang",
    "Cari penerbit","Nama","Status","Dibuat","Tindakan",
    "Menunggu","Aktif","Ditangguhkan","Dicabut","Setujui",
    "Tangguhkan","Aktifkan kembali","Terbitkan kunci","Ganti kunci","Cabut kunci",
    "Tutup","Konfirmasi tindakan ini?","Batal","Tidak ada data",
    "Login administrator diperlukan","Koneksi tidak tersedia","Memuat","Tersimpan",
    "Permintaan gagal","Salin kunci ini sekarang. Kunci tidak dapat dilihat lagi.",
    "Salin","Tersalin","Pilih penerbit","Tidak ada kunci","Tidak ada aktivitas","Bahasa"
  ]
};

export const messages = Object.fromEntries(
  Object.entries(rows).map(([locale, values]) => {
    if (values.length !== keys.length) {
      throw new Error(`Missing translations: ${locale}`);
    }
    return [locale, Object.fromEntries(keys.map((key, i) => [key, values[i]]))];
  })
);

export function resolveLocale(preferred = []) {
  for (const value of preferred) {
    const normalized = String(value || "").toLowerCase();
    const exact = languages.find(([code]) => code.toLowerCase() === normalized);
    if (exact) return exact[0];
    if (normalized.startsWith("zh")) {
      return /tw|hk|hant/.test(normalized) ? "zh-TW" : "zh-CN";
    }
    const partial = languages.find(([code]) =>
      code.split("-")[0].toLowerCase() === normalized.split("-")[0]
    );
    if (partial) return partial[0];
  }
  return "en";
}

export function t(locale, key) {
  if (!Object.hasOwn(messages, locale)) throw new Error("Unsupported locale");
  if (!Object.hasOwn(messages[locale], key)) throw new Error(`Missing key: ${key}`);
  return messages[locale][key];
}

export function localeDirection(locale) {
  return languages.find(([code]) => code === locale)?.[2] ?? "ltr";
}
