package app.sundreamer.ghosti;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.inputmethodservice.InputMethodService;
import android.os.Build;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.List;

/**
 * [Ghosti 3귀신] Android 앱 미진입 입력창 직결 정공법 — 공식 IME 7일 클립보드 키보드
 * - 카톡·크롬·문자·메모장 등 어느 입력창에서든 본체 앱으로 전환하지 않고
 *   지구본/키보드 전환 버튼 1번으로 PC+폰 통합 7일 클립보드(최대 500건)를 즉시 커서에 꽂습니다.
 * - 1→2→3 순차 붙여넣기, 현재 OS 클립보드 즉시 감지·7일 스택 누적·PC E2EE 전송 큐 연동을 지원합니다.
 * - Google Play 심사 100% 통과 공식 InputMethodService 구조 (AccessibilityService 미사용).
 */
public class GhostiClipboardImeService extends InputMethodService {
    private LinearLayout listContainer;
    private TextView headerTitle;
    private TextView seqBtn;
    private ClipboardManager clipboardManager;
    private String lastCapturedHash = "";

    private final ClipboardManager.OnPrimaryClipChangedListener clipListener = () -> {
        captureCurrentOsClipboardIfChanged(false);
    };

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            v,
            getResources().getDisplayMetrics()
        ));
    }

    private GradientDrawable roundedBg(int fillColor, int strokeColor, int radiusDp) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(fillColor);
        gd.setCornerRadius(dp(radiusDp));
        if (strokeColor != 0) {
            gd.setStroke(dp(1), strokeColor);
        }
        return gd;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            clipboardManager = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboardManager != null) {
                clipboardManager.addPrimaryClipChangedListener(clipListener);
            }
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onDestroy() {
        try {
            if (clipboardManager != null) {
                clipboardManager.removePrimaryClipChangedListener(clipListener);
            }
        } catch (Throwable ignored) {
        }
        super.onDestroy();
    }

    @Override
    public View onCreateInputView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#F8FAFC"));
        root.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(290)
        ));

        // 1. 상단 툴바
        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setBackgroundColor(Color.WHITE);
        topBar.setPadding(dp(12), dp(8), dp(12), dp(8));

        headerTitle = new TextView(this);
        headerTitle.setText("귀신 7일 클립보드");
        headerTitle.setTextColor(Color.parseColor("#0F172A"));
        headerTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
        headerTitle.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        headerTitle.setLayoutParams(titleLp);
        topBar.addView(headerTitle);

        seqBtn = makeActionChip("1→2→3 순차", Color.parseColor("#0D9488"), Color.WHITE);
        seqBtn.setOnClickListener(v -> handleSequentialPaste());
        topBar.addView(seqBtn);

        TextView captureBtn = makeActionChip("복사 담기", Color.parseColor("#F1F5F9"), Color.parseColor("#334155"));
        LinearLayout.LayoutParams capLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        capLp.leftMargin = dp(6);
        captureBtn.setLayoutParams(capLp);
        captureBtn.setOnClickListener(v -> captureCurrentOsClipboardIfChanged(true));
        topBar.addView(captureBtn);

        TextView switchBackBtn = makeActionChip("원래 키보드", Color.parseColor("#E2E8F0"), Color.parseColor("#0F172A"));
        LinearLayout.LayoutParams swLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        swLp.leftMargin = dp(6);
        switchBackBtn.setLayoutParams(swLp);
        switchBackBtn.setOnClickListener(v -> switchBackToPreviousKeyboard());
        topBar.addView(switchBackBtn);

        root.addView(topBar);

        View divider = new View(this);
        divider.setBackgroundColor(Color.parseColor("#E2E8F0"));
        divider.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        root.addView(divider);

        // 2. 7일 클립보드 스크롤 목록
        ScrollView scroll = new ScrollView(this);
        scroll.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(242)
        ));
        scroll.setFillViewport(true);

        listContainer = new LinearLayout(this);
        listContainer.setOrientation(LinearLayout.VERTICAL);
        listContainer.setPadding(dp(10), dp(8), dp(10), dp(12));
        scroll.addView(listContainer);
        root.addView(scroll);

        refreshClipListView();
        return root;
    }

    private TextView makeActionChip(String label, int bgColor, int textColor) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(textColor);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setBackground(roundedBg(bgColor, 0, 8));
        tv.setPadding(dp(10), dp(6), dp(10), dp(6));
        return tv;
    }

    @Override
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        captureCurrentOsClipboardIfChanged(false);
        refreshClipListView();
        // 본체 앱을 열지 않고도 키보드 오픈 즉시 PC의 최신 E2EE 클립보드를 직통 수신·목록 갱신
        GhostiNativeClipboardSync.pullRemoteAsync(this, () -> refreshClipListView());
    }

    private void captureCurrentOsClipboardIfChanged(boolean userTriggered) {
        try {
            if (clipboardManager == null) {
                clipboardManager = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            }
            if (clipboardManager == null || !clipboardManager.hasPrimaryClip()) {
                if (userTriggered) {
                    Toast.makeText(this, "현재 복사된 텍스트가 없습니다.", Toast.LENGTH_SHORT).show();
                }
                return;
            }
            ClipData clip = clipboardManager.getPrimaryClip();
            if (clip == null || clip.getItemCount() == 0) return;
            CharSequence cs = clip.getItemAt(0).coerceToText(this);
            String txt = cs != null ? cs.toString().trim() : "";
            if (txt.isEmpty()) return;
            String hash = GhostiSharedClipboardStore.sha256Hex(txt);
            if (!userTriggered && hash.equals(lastCapturedHash)) {
                return;
            }
            lastCapturedHash = hash;
            GhostiSharedClipboardStore.pushLocalCapturedClip(
                this,
                txt,
                GhostiSharedClipboardStore.defaultDeviceLabel()
            );
            refreshClipListView();
            if (userTriggered) {
                Toast.makeText(this, "7일 클립보드에 담았습니다.", Toast.LENGTH_SHORT).show();
            }
        } catch (Throwable ignored) {
        }
    }

    private void handleSequentialPaste() {
        List<GhostiSharedClipboardStore.ClipEntry> items = GhostiSharedClipboardStore.loadHistory(this);
        if (items.isEmpty()) {
            Toast.makeText(this, "저장된 7일 클립보드가 없습니다.", Toast.LENGTH_SHORT).show();
            return;
        }
        int idx = GhostiSharedClipboardStore.nextSequentialIndex(this, items.size());
        GhostiSharedClipboardStore.ClipEntry target = items.get(idx);
        InputConnection ic = getCurrentInputConnection();
        if (ic != null) {
            ic.commitText(target.text, 1);
            Toast.makeText(this, (idx + 1) + "번 항목 입력 완료", Toast.LENGTH_SHORT).show();
        }
    }

    private void switchBackToPreviousKeyboard() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (switchToPreviousInputMethod()) return;
            }
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.showInputMethodPicker();
            }
        } catch (Throwable ignored) {
        }
    }

    private void refreshClipListView() {
        if (listContainer == null) return;
        listContainer.removeAllViews();
        List<GhostiSharedClipboardStore.ClipEntry> items = GhostiSharedClipboardStore.loadHistory(this);
        if (headerTitle != null) {
            headerTitle.setText("귀신 7일 클립보드 (" + items.size() + ")");
        }

        if (items.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("PC나 폰에서 텍스트를 복사하면 7일간(최대 500건) 여기에 자동 표시됩니다.\n터치 한 번으로 현재 입력창에 바로 붙여넣을 수 있습니다.");
            empty.setTextColor(Color.parseColor("#64748B"));
            empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
            empty.setPadding(dp(12), dp(24), dp(12), dp(24));
            empty.setGravity(Gravity.CENTER);
            listContainer.addView(empty);
            return;
        }

        int displayCount = Math.min(items.size(), 80);
        for (int i = 0; i < displayCount; i++) {
            final GhostiSharedClipboardStore.ClipEntry entry = items.get(i);
            final int num = i + 1;
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setBackground(roundedBg(Color.WHITE, Color.parseColor("#E2E8F0"), 10));
            card.setPadding(dp(12), dp(9), dp(12), dp(9));
            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            cardLp.bottomMargin = dp(6);
            card.setLayoutParams(cardLp);

            TextView meta = new TextView(this);
            meta.setText("#" + num + " · " + entry.senderName);
            meta.setTextColor(Color.parseColor("#0D9488"));
            meta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f);
            meta.setTypeface(Typeface.DEFAULT_BOLD);
            card.addView(meta);

            TextView body = new TextView(this);
            body.setText(entry.text);
            body.setTextColor(Color.parseColor("#0F172A"));
            body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f);
            body.setMaxLines(2);
            body.setEllipsize(TextUtils.TruncateAt.END);
            LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            bodyLp.topMargin = dp(2);
            body.setLayoutParams(bodyLp);
            card.addView(body);

            card.setOnClickListener(v -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    ic.commitText(entry.text, 1);
                }
            });

            listContainer.addView(card);
        }
    }
}
