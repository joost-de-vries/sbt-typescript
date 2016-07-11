package name.devries.sbt.typescript;

//



import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 *  Minify.java
 *  jsonminifier - Ported from https://github.com/getify/JSON.minify
 *
 *  Created by Bernhard Gass on 8/01/13.
 *  Copyright © 2013 Bernhard Gass. All rights reserved.
 */
object JsonCleaner {

    val TOKENIZER = "\"|(/\\*)|(\\*/)|(//)|\\n|\\r";
    val MAGIC = "(\\\\)*$";
    val PATTERN = Pattern.compile(TOKENIZER);
    val MAGIC_PATTERN = Pattern.compile(MAGIC);

    /**
     * @param json a json object with comments
     * @return a compact json object with comments stripped out
     */
    def minify(json:CharSequence ) : String={
        if (json == null)
            throw new IllegalArgumentException("Parameter 'json' cannot be null.");

        val jsonString = json.toString();

        var in_string = false;
        var in_multiline_comment = false;
        var in_singleline_comment = false;
        var tmp :String="";
        var tmp2: String="";
        val new_str = new StringBuilder();
        var from = 0;
        var lc:String = "";
        var rc = "";

        val matcher = PATTERN.matcher(jsonString);

        var magicMatcher:Matcher=null;
        var foundMagic:Boolean=false;

        if (!matcher.find()){
             jsonString;
        } else{
            matcher.reset();

            while (matcher.find()) {
                lc = jsonString.substring(0, matcher.start());
                rc = jsonString.substring(matcher.end(), jsonString.length());
                tmp = jsonString.substring(matcher.start(), matcher.end());

                if (!in_multiline_comment && !in_singleline_comment) {
                    tmp2 = lc.substring(from);
                    if (!in_string)
                        tmp2 = tmp2.replaceAll("(\\n|\\r|\\s)*", "");

                    new_str.append(tmp2);
                }
                from = matcher.end();

                if (tmp.charAt(0) == '\"' && !in_multiline_comment && !in_singleline_comment) {
                    magicMatcher = MAGIC_PATTERN.matcher(lc);
                    foundMagic = magicMatcher.find();
                    if (!in_string || !foundMagic || (magicMatcher.end() - magicMatcher.start()) % 2 == 0) {
                        in_string = !in_string;
                    }
                    from -= 1;
                    rc = jsonString.substring(from);
                } else if (tmp.startsWith("/*") && !in_string && !in_multiline_comment && !in_singleline_comment) {
                    in_multiline_comment = true;
                } else if (tmp.startsWith("*/") && !in_string && in_multiline_comment) {
                    in_multiline_comment = false;
                } else if (tmp.startsWith("//") && !in_string && !in_multiline_comment && !in_singleline_comment) {
                    in_singleline_comment = true;
                } else if ((tmp.startsWith("\n") || tmp.startsWith("\r")) && !in_string && !in_multiline_comment && in_singleline_comment) {
                    in_singleline_comment = false;
                } else if (!in_multiline_comment && !in_singleline_comment && !tmp.substring(0, 1).matches("\\n|\\r|\\s")) {
                    new_str.append(tmp);
                }
            }
            new_str.append(rc);

            new_str.toString();

        }
    }

}
